import { routes, uploadedFiles, type Route, type InsertRoute, type UploadedFile, type InsertUploadedFile } from "@shared/schema";

export interface IStorage {
  // Route operations
  createRoute(route: InsertRoute): Promise<Route>;
  getRoute(id: number): Promise<Route | undefined>;
  updateRoute(id: number, route: Partial<InsertRoute>): Promise<Route | undefined>;
  deleteRoute(id: number): Promise<boolean>;
  
  // File operations
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  getUploadedFile(id: number): Promise<UploadedFile | undefined>;
  getUploadedFiles(): Promise<UploadedFile[]>;
  deleteUploadedFile(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private routes: Map<number, Route>;
  private uploadedFiles: Map<number, UploadedFile>;
  private currentRouteId: number;
  private currentFileId: number;

  constructor() {
    this.routes = new Map();
    this.uploadedFiles = new Map();
    this.currentRouteId = 1;
    this.currentFileId = 1;
  }

  // Route operations
  async createRoute(insertRoute: InsertRoute): Promise<Route> {
    const id = this.currentRouteId++;
    const route: Route = {
      ...insertRoute,
      id,
      createdAt: new Date(),
      overlap: insertRoute.overlap ?? null,
      turnRadius: insertRoute.turnRadius ?? null,
      transectLines: insertRoute.transectLines ?? null,
      waypoints: insertRoute.waypoints ?? null,
      totalDistance: insertRoute.totalDistance ?? null,
      estimatedTime: insertRoute.estimatedTime ?? null,
    };
    this.routes.set(id, route);
    return route;
  }

  async getRoute(id: number): Promise<Route | undefined> {
    return this.routes.get(id);
  }

  async updateRoute(id: number, updateData: Partial<InsertRoute>): Promise<Route | undefined> {
    const existing = this.routes.get(id);
    if (!existing) return undefined;

    const updated: Route = {
      ...existing,
      ...updateData,
    };
    this.routes.set(id, updated);
    return updated;
  }

  async deleteRoute(id: number): Promise<boolean> {
    return this.routes.delete(id);
  }

  // File operations
  async createUploadedFile(insertFile: InsertUploadedFile): Promise<UploadedFile> {
    const id = this.currentFileId++;
    const file: UploadedFile = {
      ...insertFile,
      id,
      uploadedAt: new Date(),
      polygon: insertFile.polygon ?? null,
    };
    this.uploadedFiles.set(id, file);
    return file;
  }

  async getUploadedFile(id: number): Promise<UploadedFile | undefined> {
    return this.uploadedFiles.get(id);
  }

  async getUploadedFiles(): Promise<UploadedFile[]> {
    return Array.from(this.uploadedFiles.values());
  }

  async deleteUploadedFile(id: number): Promise<boolean> {
    return this.uploadedFiles.delete(id);
  }
}

export const storage = new MemStorage();
