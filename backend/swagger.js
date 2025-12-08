/**
 * @author GAULT Rudy
 * @company Cloud Temple
 * @created_at 2025-12-08 14:24:37
 * @updated_by GAULT Rudy
 * @updated_at 2025-12-08 14:24:41
 */

import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "SUPCHAT API",
    version: "1.0.0",
    description: "Documentation de l’API SUPCHAT (Express)",
  },
  servers: [
    {
      url: "http://localhost:3001/api",
      description: "Serveur local",
    },
  ],
};

const options = {
  swaggerDefinition,
  // Inclure tous les fichiers de routes pour la documentation automatique
  apis: [
    path.join(__dirname, "routes", "*.js"),
    path.join(__dirname, "controllers", "*.js"),
  ],
};

const swaggerSpec = swaggerJSDoc(options);

export default (app) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
