import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart Energy Grid System - API Gateway',
      version: '1.0.0',
      description:
        'Central REST API for the Smart Energy Grid Management System (SEGS). Provides authenticated access to user data, billing information, operator dashboards, and real-time grid monitoring.',
      contact: {
        name: 'SEGS API Support',
        email: 'support@segs.example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'http://api-gateway:3000',
        description: 'Docker internal server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              example: 'USR-001',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            name: {
              type: 'string',
              example: 'Om Argade',
            },
            role: {
              type: 'string',
              enum: ['USER', 'OPERATOR', 'ADMIN'],
              example: 'USER',
            },
            region: {
              type: 'string',
              example: 'Pune-West',
            },
            meterId: {
              type: 'string',
              example: 'METER-001',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Alert: {
          type: 'object',
          properties: {
            alert_id: {
              type: 'string',
              example: 'ALT-001',
            },
            meter_id: {
              type: 'string',
              example: 'METER-001',
            },
            region: {
              type: 'string',
              example: 'Pune-West',
            },
            alert_type: {
              type: 'string',
              example: 'high_consumption',
            },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              example: 'high',
            },
            message: {
              type: 'string',
              example: 'Power consumption exceeded threshold',
            },
            threshold_value: {
              type: 'number',
              example: 100.0,
            },
            actual_value: {
              type: 'number',
              example: 125.5,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            resolved_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            is_resolved: {
              type: 'boolean',
              example: false,
            },
          },
        },
        Tariff: {
          type: 'object',
          properties: {
            tariff_id: {
              type: 'string',
              example: 'TARIFF-001',
            },
            region: {
              type: 'string',
              example: 'Pune-West',
            },
            time_of_day: {
              type: 'string',
              example: 'peak',
            },
            price_per_kwh: {
              type: 'number',
              example: 8.5,
            },
            effective_from: {
              type: 'string',
              format: 'date-time',
            },
            effective_to: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            is_active: {
              type: 'boolean',
              example: true,
            },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            invoice_id: {
              type: 'string',
              example: 'INV-001',
            },
            user_id: {
              type: 'string',
              example: 'USR-001',
            },
            billing_period_start: {
              type: 'string',
              format: 'date-time',
            },
            billing_period_end: {
              type: 'string',
              format: 'date-time',
            },
            total_kwh: {
              type: 'number',
              example: 450.5,
            },
            total_amount: {
              type: 'number',
              example: 3825.25,
            },
            currency: {
              type: 'string',
              example: 'INR',
            },
            status: {
              type: 'string',
              enum: ['pending', 'paid', 'overdue'],
              example: 'paid',
            },
            due_date: {
              type: 'string',
              format: 'date-time',
            },
            paid_date: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ConsumptionData: {
          type: 'object',
          properties: {
            window_start: {
              type: 'string',
              format: 'date-time',
            },
            meter_id: {
              type: 'string',
              example: 'METER-001',
            },
            region: {
              type: 'string',
              example: 'Pune-West',
            },
            avg_power_kw: {
              type: 'number',
              example: 5.5,
            },
            max_power_kw: {
              type: 'number',
              example: 7.2,
            },
            min_power_kw: {
              type: 'number',
              example: 3.8,
            },
            energy_kwh_sum: {
              type: 'number',
              example: 0.092,
            },
            voltage_avg: {
              type: 'number',
              example: 230.5,
            },
            current_avg: {
              type: 'number',
              example: 23.9,
            },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            data: {
              type: 'object',
            },
            error: {
              type: 'string',
            },
            message: {
              type: 'string',
            },
            meta: {
              type: 'object',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            details: {
              type: 'object',
            },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Unauthorized - Invalid or missing authentication token',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFound: {
          description: 'Not Found - Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Users',
        description: 'User profile and consumption data endpoints',
      },
      {
        name: 'Billing',
        description: 'Invoice and billing information endpoints',
      },
      {
        name: 'Operator',
        description: 'Operator and admin dashboard endpoints',
      },
      {
        name: 'System',
        description: 'System health and monitoring endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
