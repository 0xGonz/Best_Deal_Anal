import express from "express";
import { setupVite, serveStatic } from "./vite";

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize the application
async function initialize() {
  console.log('Starting simplified server...');
  
  if (process.env.NODE_ENV === "development") {
    await setupVite(app);
  } else {
    serveStatic(app);
  }

  app.listen(PORT, "0.0.0.0", () => {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    
    console.log(`Server running on port ${PORT} at ${formattedTime}`);
  });
}

// Handle startup errors
initialize().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});