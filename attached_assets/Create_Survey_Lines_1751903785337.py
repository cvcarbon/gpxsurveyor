#%%
lease_numbers = arcpy.GetParameterAsText(0)
spacing_feet = arcpy.GetParameterAsText(1)
method = 'Manual'  # or 'Auto'
initial_bearing = arcpy.GetParameterAsText(2)

# Create a string from the lease numbers for file naming
lease_numbers = [s.strip() for s in lease_numbers.split(";")]

#output_gpx = arcpy.GetParameterAsText(3)
lease_numbers_str = "_".join(lease_numbers)
output_gpx = f"{lease_numbers_str}_{spacing_feet:.0f}ft_{initial_bearing:.0f}d_autopilot.gpx"

#%%

import tempfile
import math
import arcpy
from arcgis.gis import GIS
arcpy.env.overwriteOutput = True

gis = GIS("home")

# Parameter index 4: Lease feature layer item ID in ArcGIS Online
lease_item_id = "765c8c9d9d1d45b09bd98a472ad00de1"

# -------------------------------------------------------------------
# Connect to ArcGIS Online and get the feature layer
# -------------------------------------------------------------------
item = gis.content.get(lease_item_id)
lease_layer = item.layers[0]

# Build SQL query string to select all desired leases
query_str = "LEASE_NUMB IN (" + ",".join([f"'{num}'" for num in lease_numbers]) + ")"
result = lease_layer.query(where=query_str, out_fields="*", return_geometry=True)
features = result.features
if len(features) == 0:
    raise Exception("No matching leases found in layer.")

# Convert each feature's geometry to an ArcPy Polygon (in WGS84)
wgs84 = arcpy.SpatialReference(4326)
lease_polygons = []
for feature in features:
    poly = arcpy.AsShape(feature.geometry, True)
    if poly.spatialReference.factoryCode != 4326:
        poly = poly.projectAs(wgs84)
    lease_polygons.append(poly)

# Union all lease polygons into one combined polygon.
# (This treats the overall extent as one big area.)
combined_polygon = lease_polygons[0]
for poly in lease_polygons[1:]:
    combined_polygon = combined_polygon.union(poly)

lease_polygon = combined_polygon

# -------------------------------------------------------------------
# Determine a projected spatial reference (UTM zone based on centroid)
# -------------------------------------------------------------------
centroid = lease_polygon.centroid
utm_zone = int((centroid.X + 180) // 6) + 1
utm_sr = arcpy.SpatialReference(32600 + utm_zone)  # For Northern Hemisphere

# Project the polygon to the chosen planar spatial reference
lease_polygon_proj = lease_polygon.projectAs(utm_sr)

# -------------------------------------------------------------------
# Convert spacing and extension distances (feet to meters)
# -------------------------------------------------------------------
spacing = int(spacing_feet) * 0.3048
extend_dist = 20.0 * 0.3048

# Calculate the unit direction vector for the survey lines
angle_rad = math.radians(float(initial_bearing))
dx = math.sin(angle_rad)
dy = math.cos(angle_rad)
D = (dx, dy)
P = (dy, -dx)

# -------------------------------------------------------------------
# Calculate survey lines that span the combined polygon
# -------------------------------------------------------------------
all_points = []
for part in lease_polygon_proj.getPart():
    for pt in part:
        if pt:
            all_points.append((pt.X, pt.Y))
proj_vals = [x * P[0] + y * P[1] for (x, y) in all_points]
min_proj = min(proj_vals)
max_proj = max(proj_vals)
width = max_proj - min_proj
num_lines = int(math.ceil(width / spacing)) + 1

survey_lines = []
ext = lease_polygon_proj.extent
max_dim = math.hypot(ext.width, ext.height)
line_length = max_dim * 2

for i in range(num_lines):
    offset = min_proj + i * spacing
    centroid_geom = arcpy.PointGeometry(centroid, lease_polygon.spatialReference)
    centroid_proj = centroid_geom.projectAs(utm_sr)
    centroid_xy = (centroid_proj.firstPoint.X, centroid_proj.firstPoint.Y)
    current_proj = centroid_xy[0] * P[0] + centroid_xy[1] * P[1]
    shift = offset - current_proj
    base_point = (centroid_xy[0] + shift * P[0], centroid_xy[1] + shift * P[1])
    half_len = line_length / 2.0
    start_point = (base_point[0] - half_len * D[0], base_point[1] - half_len * D[1])
    end_point   = (base_point[0] + half_len * D[0], base_point[1] + half_len * D[1])
    line_geom = arcpy.Polyline(arcpy.Array([arcpy.Point(*start_point), arcpy.Point(*end_point)]), utm_sr)
    line_inside = line_geom.intersect(lease_polygon_proj, 2)
    if line_inside is None or line_inside.pointCount == 0:
        continue
    survey_lines.append(line_inside)

# -------------------------------------------------------------------
# Extend each survey line slightly beyond the polygon
# -------------------------------------------------------------------
extended_lines = []
for line in survey_lines:
    points = [pt for pt in line.getPart(0)]
    if not points:
        continue
    start_pt = points[0]
    end_pt = points[-1]
    dx_line = end_pt.X - start_pt.X
    dy_line = end_pt.Y - start_pt.Y
    length_line = math.hypot(dx_line, dy_line)
    if length_line == 0:
        continue
    dir_x = dx_line / length_line
    dir_y = dy_line / length_line
    extended_start = arcpy.Point(start_pt.X - dir_x * extend_dist, start_pt.Y - dir_y * extend_dist)
    extended_end   = arcpy.Point(end_pt.X   + dir_x * extend_dist, end_pt.Y   + dir_y * extend_dist)
    extended_line = arcpy.Polyline(arcpy.Array([extended_start, extended_end]), utm_sr)
    extended_lines.append(extended_line)

# -------------------------------------------------------------------
# Build the overall route by joining survey lines and creating smooth turns
# -------------------------------------------------------------------
route_points = []
for idx, line in enumerate(extended_lines):
    pt_start = line.firstPoint
    pt_end = line.lastPoint
    if idx % 2 == 0:
        travel_start = pt_start
        travel_end = pt_end
    else:
        travel_start = pt_end
        travel_end = pt_start

    if idx == 0:
        route_points.append(arcpy.Point(travel_start.X, travel_start.Y))
        route_points.append(arcpy.Point(travel_end.X, travel_end.Y))
    else:
        route_points.append(arcpy.Point(travel_end.X, travel_end.Y))

    if idx < len(extended_lines) - 1:
        turn_right = (idx % 2 == 0)
        next_line = extended_lines[idx + 1]
        if (idx + 1) % 2 == 0:
            next_start = next_line.firstPoint
        else:
            next_start = next_line.lastPoint

        P_end = arcpy.Point(travel_end.X, travel_end.Y)
        P_next = arcpy.Point(next_start.X, next_start.Y)
        p_end_D = P_end.X * D[0] + P_end.Y * D[1]
        
        def adjust_point(P, D, target):
            current = P.X * D[0] + P.Y * D[1]
            shift = target - current
            return arcpy.Point(P.X + shift * D[0], P.Y + shift * D[1])
        
        T1 = P_end
        T2 = adjust_point(P_next, D, p_end_D)
        chord_dx = T2.X - T1.X
        chord_dy = T2.Y - T1.Y
        chord_dist = math.hypot(chord_dx, chord_dy)
        R = chord_dist / 2.0
        centerX = (T1.X + T2.X) / 2.0
        centerY = (T1.Y + T2.Y) / 2.0
        start_angle = math.atan2(T1.Y - centerY, T1.X - centerX)
        arc_points = []
        segments = 12  # Increase for a smoother arc
        if turn_right:
            for j in range(1, segments):
                theta = start_angle - (math.pi * j / segments)
                x = centerX + R * math.cos(theta)
                y = centerY + R * math.sin(theta)
                arc_points.append(arcpy.Point(x, y))
        else:
            for j in range(1, segments):
                theta = start_angle + (math.pi * j / segments)
                x = centerX + R * math.cos(theta)
                y = centerY + R * math.sin(theta)
                arc_points.append(arcpy.Point(x, y))
        route_points.extend(arc_points)
        route_points.append(arcpy.Point(T2.X, T2.Y))

route_polyline_proj = arcpy.Polyline(arcpy.Array(route_points), utm_sr)
route_polyline_wgs = route_polyline_proj.projectAs(wgs84)

temp_gdb = arcpy.env.scratchGDB
temp_fc = temp_gdb + r"\RouteLine"
arcpy.management.CreateFeatureclass(temp_gdb, "RouteLine", "POLYLINE", spatial_reference=wgs84)
arcpy.management.AddField(temp_fc, "Name", "TEXT")
with arcpy.da.InsertCursor(temp_fc, ["SHAPE@", "Name"]) as cur:
    cur.insertRow([route_polyline_wgs, f"Lease_{lease_numbers}"])

# Export the feature class to GPX
arcpy.conversion.FeaturesToGPX(temp_fc, output_gpx, "OBJECTID")

arcpy.AddMessage(f"GPX route saved to {output_gpx}")
