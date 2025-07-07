import { pgTable, text, serial, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const routes = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  polygon: json("polygon").notNull(), // GeoJSON polygon
  distance: integer("distance").notNull(), // meters
  bearing: integer("bearing").notNull(), // degrees
  overlap: integer("overlap").default(10), // percentage
  turnRadius: integer("turn_radius").default(20), // meters
  transectLines: json("transect_lines"), // Generated route data
  waypoints: json("waypoints"), // GPX waypoints
  totalDistance: integer("total_distance"), // meters
  estimatedTime: integer("estimated_time"), // minutes
  createdAt: timestamp("created_at").defaultNow(),
});

export const uploadedFiles = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // 'kml' | 'shp'
  fileData: json("file_data").notNull(),
  polygon: json("polygon"), // Extracted polygon data
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
});

export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).omit({
  id: true,
  uploadedAt: true,
});

export const routeParametersSchema = z.object({
  distance: z.number().min(1).max(1000),
  bearing: z.number().min(0).max(360),
  overlap: z.number().min(0).max(50).default(10),
  turnRadius: z.number().min(1).max(100).default(20),
});

export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;
export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type RouteParameters = z.infer<typeof routeParametersSchema>;
