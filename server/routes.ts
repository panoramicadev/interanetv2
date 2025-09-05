import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertSalesTransactionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Sales metrics endpoint
  app.get('/api/sales/metrics', isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, salesperson, segment } = req.query;
      const metrics = await storage.getSalesMetrics({
        startDate: startDate as string,
        endDate: endDate as string,
        salesperson: salesperson as string,
        segment: segment as string,
      });
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching sales metrics:", error);
      res.status(500).json({ message: "Failed to fetch sales metrics" });
    }
  });

  // Sales transactions endpoint
  app.get('/api/sales/transactions', isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, salesperson, segment, limit, offset } = req.query;
      const transactions = await storage.getSalesTransactions({
        startDate: startDate as string,
        endDate: endDate as string,
        salesperson: salesperson as string,
        segment: segment as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching sales transactions:", error);
      res.status(500).json({ message: "Failed to fetch sales transactions" });
    }
  });

  // Top salespeople endpoint
  app.get('/api/sales/top-salespeople', isAuthenticated, async (req, res) => {
    try {
      const { limit } = req.query;
      const topSalespeople = await storage.getTopSalespeople(
        limit ? parseInt(limit as string) : undefined
      );
      res.json(topSalespeople);
    } catch (error) {
      console.error("Error fetching top salespeople:", error);
      res.status(500).json({ message: "Failed to fetch top salespeople" });
    }
  });

  // Top products endpoint
  app.get('/api/sales/top-products', isAuthenticated, async (req, res) => {
    try {
      const { limit } = req.query;
      const topProducts = await storage.getTopProducts(
        limit ? parseInt(limit as string) : undefined
      );
      res.json(topProducts);
    } catch (error) {
      console.error("Error fetching top products:", error);
      res.status(500).json({ message: "Failed to fetch top products" });
    }
  });

  // Segment analysis endpoint
  app.get('/api/sales/segments', isAuthenticated, async (req, res) => {
    try {
      const segmentAnalysis = await storage.getSegmentAnalysis();
      res.json(segmentAnalysis);
    } catch (error) {
      console.error("Error fetching segment analysis:", error);
      res.status(500).json({ message: "Failed to fetch segment analysis" });
    }
  });

  // Sales chart data endpoint
  app.get('/api/sales/chart-data', isAuthenticated, async (req, res) => {
    try {
      const { period = 'monthly' } = req.query;
      const chartData = await storage.getSalesChartData(period as 'weekly' | 'monthly');
      res.json(chartData);
    } catch (error) {
      console.error("Error fetching chart data:", error);
      res.status(500).json({ message: "Failed to fetch chart data" });
    }
  });

  // CSV import endpoint
  app.post('/api/sales/import', isAuthenticated, async (req, res) => {
    try {
      const { transactions } = req.body;
      
      if (!Array.isArray(transactions)) {
        return res.status(400).json({ message: "Invalid data format" });
      }

      // Validate each transaction
      const validatedTransactions = [];
      const errors = [];
      
      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        
        
        try {
          const validated = insertSalesTransactionSchema.parse(transaction);
          validatedTransactions.push(validated);
        } catch (error: any) {
          errors.push({
            index: i,
            transaction: transaction.nudo || `Row ${i + 1}`,
            error: error.issues ? error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ') : error.message
          });
          console.warn(`Skipping invalid transaction at row ${i + 1}:`, transaction.nudo, error.issues);
        }
      }

      if (validatedTransactions.length === 0) {
        return res.status(400).json({ 
          message: "No valid transactions found",
          errors: errors.slice(0, 5) // Show first 5 errors
        });
      }

      await storage.insertMultipleSalesTransactions(validatedTransactions);
      
      res.json({ 
        message: "Data imported successfully",
        imported: validatedTransactions.length,
        total: transactions.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined
      });
    } catch (error) {
      console.error("Error importing sales data:", error);
      res.status(500).json({ message: "Failed to import sales data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
