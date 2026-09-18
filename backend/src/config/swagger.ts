import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Attendance SMS API",
      version: "1.0.0",
      description: "API de gestion des présences et notifications SMS",
    },
    servers: [{ url: "http://localhost:5000", description: "Dev" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
});
