# GIS Route Planner - Autopilot Route Generator

## Overview

This is a full-stack web application that generates autopilot routes for transect-based surveys. The application allows users to upload polygon files (KML/SHP), define route parameters, and generate optimized flight paths with waypoints that can be exported in various formats (GPX, KML).

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **UI Library**: Radix UI with shadcn/ui components
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: React hooks and TanStack Query for server state
- **Routing**: Wouter for client-side routing
- **Map Integration**: Leaflet with drawing capabilities
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **File Processing**: Multer for uploads, custom parsers for KML/SHP
- **Geospatial**: Turf.js for geometric calculations
- **Session Management**: PostgreSQL-backed sessions

## Key Components

### Frontend Components
1. **Route Planner Page**: Main application interface
2. **Sidebar**: Contains all control panels and parameters
3. **Map Container**: Interactive map with drawing tools
4. **Polygon Input**: File upload and drawing interface
5. **Route Parameters**: Configuration for route generation
6. **Route Generation**: Trigger and display route creation
7. **Export Options**: GPX/KML export functionality

### Backend Components
1. **Routes Handler**: API endpoints for file upload and route generation
2. **Storage Layer**: Abstracted data access with in-memory fallback
3. **File Parsers**: KML and SHP file processing utilities
4. **Geospatial Engine**: Route calculation and optimization

### Database Schema
```sql
-- Routes table for storing generated routes
routes (
  id: serial primary key,
  name: text,
  polygon: json,           -- GeoJSON polygon
  distance: integer,       -- transect distance in meters
  bearing: integer,        -- bearing in degrees
  overlap: integer,        -- overlap percentage
  turn_radius: integer,    -- turn radius in meters
  transect_lines: json,    -- generated route data
  waypoints: json,         -- GPX waypoints
  total_distance: integer, -- total route distance
  estimated_time: integer, -- estimated time in minutes
  created_at: timestamp
)

-- Uploaded files table
uploaded_files (
  id: serial primary key,
  file_name: text,
  file_type: text,         -- 'kml' or 'shp'
  file_data: json,         -- parsed file content
  polygon: json,           -- extracted polygon
  uploaded_at: timestamp
)
```

## Data Flow

1. **File Upload**: User uploads KML/SHP files via drag-and-drop or file picker
2. **File Processing**: Server parses files and extracts polygon geometries
3. **Parameter Configuration**: User adjusts route parameters (distance, bearing, overlap, turn radius)
4. **Route Generation**: Server calculates optimal transect lines using Turf.js
5. **Route Display**: Generated route is displayed on the interactive map
6. **Export**: User can export route as GPX or KML for autopilot systems

## External Dependencies

### Frontend Dependencies
- **@radix-ui/react-***: Component primitives for UI
- **@tanstack/react-query**: Server state management
- **@turf/turf**: Geospatial calculations
- **leaflet**: Interactive mapping
- **leaflet-draw**: Drawing tools
- **wouter**: Client-side routing
- **react-hook-form**: Form handling
- **date-fns**: Date manipulation

### Backend Dependencies
- **@neondatabase/serverless**: PostgreSQL database driver
- **drizzle-orm**: TypeScript ORM
- **multer**: File upload handling
- **connect-pg-simple**: PostgreSQL session store
- **express**: Web framework
- **tsx**: TypeScript execution

## Deployment Strategy

### Development
- **Frontend**: Vite dev server with HMR
- **Backend**: tsx with auto-restart
- **Database**: PostgreSQL via environment variable

### Production
- **Build Process**: 
  - Frontend: Vite build to `dist/public`
  - Backend: esbuild bundle to `dist/index.js`
- **Runtime**: Node.js serving static files and API
- **Database**: PostgreSQL with Drizzle migrations

### Environment Variables
```
DATABASE_URL=postgresql://... # Required for database connection
NODE_ENV=production|development
VITE_ARCGIS_CLIENT_ID=your_oauth_app_id # Optional: ArcGIS OAuth App ID for authenticated layers
```

## Changelog
- July 07, 2025. Initial setup
- July 07, 2025. Enhanced route generation with speed control slider featuring multiple units (kph, mph, knots) and dynamic time estimation
- July 07, 2025. Completed curved U-turn implementation following Python reference algorithm with proper point alignment and bearing-specific turn direction handling
- July 07, 2025. Added waypoints along transect lines for smooth autopilot tracking and line extension logic to prevent reverse movement
- July 07, 2025. Updated housekeeping: removed test polygon button, changed default map view to Galveston Bay TX, implemented custom filename format {route name}_{bearing}d_{distance}m
- July 19, 2025. Implemented OAuth token-based authentication for Esri REST FeatureServer layers with automatic token storage and page refresh handling

## User Preferences

Preferred communication style: Simple, everyday language.