// GameVibe AI Enterprise API Documentation Generator
// Generates OpenAPI/Swagger documentation for the Enterprise API

import { IncomingMessage, ServerResponse } from 'http';
import { Logger } from '../utils/logger.js';

export class EnterpriseDocsAPI {
  private logger = new Logger('EnterpriseDocsAPI');

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Handle documentation routes
    if (pathname === '/api/v1/enterprise/docs' || pathname === '/api/v1/enterprise/docs/') {
      await this.handleDocsHTML(res);
      return true;
    }

    if (pathname === '/api/v1/enterprise/openapi.json') {
      await this.handleOpenAPIJSON(res);
      return true;
    }

    if (pathname === '/api/v1/enterprise/docs/postman') {
      await this.handlePostmanCollection(res);
      return true;
    }

    return false;
  }

  private async handleDocsHTML(res: ServerResponse): Promise<void> {
    const html = this.generateSwaggerHTML();
    
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.end(html);
  }

  private async handleOpenAPIJSON(res: ServerResponse): Promise<void> {
    const openApiSpec = this.generateOpenAPISpec();
    
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify(openApiSpec, null, 2));
  }

  private async handlePostmanCollection(res: ServerResponse): Promise<void> {
    const postmanCollection = this.generatePostmanCollection();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="gamevibe-enterprise-api.postman_collection.json"');
    res.statusCode = 200;
    res.end(JSON.stringify(postmanCollection, null, 2));
  }

  private generateSwaggerHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>GameVibe Enterprise API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@4.15.5/favicon-32x32.png" sizes="32x32" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@4.15.5/favicon-16x16.png" sizes="16x16" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
    .topbar {
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1rem;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .topbar h1 {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 600;
    }
    .topbar p {
      margin: 0.5rem 0 0 0;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>🎮 GameVibe Enterprise API</h1>
    <p>Comprehensive REST API for third-party integrations and enterprise clients</p>
  </div>
  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/v1/enterprise/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        tryItOutEnabled: true,
        filter: true,
        requestInterceptor: function(request) {
          // Add API key to authorization header if present
          const apiKey = localStorage.getItem('gamevibe_api_key');
          if (apiKey) {
            request.headers.Authorization = 'Bearer ' + apiKey;
          }
          return request;
        }
      });

      // Add API key input
      setTimeout(() => {
        const topbar = document.querySelector('.topbar');
        const keyInput = document.createElement('div');
        keyInput.innerHTML = \`
          <div style="margin-top: 1rem; text-align: center;">
            <input type="password" 
                   id="api-key-input" 
                   placeholder="Enter your API key to test endpoints" 
                   style="padding: 0.5rem; width: 300px; border: none; border-radius: 4px;"
                   value="\${localStorage.getItem('gamevibe_api_key') || ''}" />
            <button onclick="setApiKey()" 
                    style="padding: 0.5rem 1rem; margin-left: 0.5rem; background: white; border: none; border-radius: 4px; cursor: pointer;">
              Set API Key
            </button>
          </div>
        \`;
        topbar.appendChild(keyInput);
      }, 1000);

      window.setApiKey = function() {
        const input = document.getElementById('api-key-input');
        localStorage.setItem('gamevibe_api_key', input.value);
        alert('API key saved! You can now test the endpoints.');
      };
    };
  </script>
</body>
</html>`;
  }

  private generateOpenAPISpec(): any {
    return {
      openapi: "3.0.3",
      info: {
        title: "GameVibe Enterprise API",
        description: `
# GameVibe Enterprise API

The GameVibe Enterprise API provides comprehensive access to GameVibe's game generation, analytics, and management capabilities for enterprise clients and third-party integrations.

## Authentication

All API endpoints require authentication using an API key passed in the Authorization header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

Contact enterprise@gamevibe.ai to obtain an API key.

## Rate Limiting

Rate limits vary by subscription tier:
- **Starter**: 100 req/min, 1,000 req/hour, 10,000 req/day
- **Pro**: 500 req/min, 10,000 req/hour, 100,000 req/day  
- **Enterprise**: 2,000 req/min, 50,000 req/hour, 1,000,000 req/day

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Requests remaining in current window
- \`X-RateLimit-Reset\`: Time when rate limit resets

## Error Handling

The API uses standard HTTP status codes and returns error details in JSON format:

\`\`\`json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {}
}
\`\`\`

## Webhooks

Configure webhooks to receive real-time notifications about events:
- Game creations and updates
- User activity
- Subscription changes
- Analytics milestones

## Support

- 📧 Email: enterprise@gamevibe.ai
- 📚 Documentation: https://docs.gamevibe.ai/enterprise-api
- 💬 Discord: https://discord.gg/gamevibe
        `,
        version: "1.0.0",
        contact: {
          name: "GameVibe Enterprise Support",
          email: "enterprise@gamevibe.ai",
          url: "https://gamevibe.ai/enterprise"
        },
        license: {
          name: "Commercial",
          url: "https://gamevibe.ai/license"
        }
      },
      servers: [
        {
          url: "https://api.gamevibe.ai",
          description: "Production server"
        },
        {
          url: "https://staging-api.gamevibe.ai", 
          description: "Staging server"
        }
      ],
      security: [
        {
          ApiKeyAuth: []
        }
      ],
      paths: {
        "/api/v1/enterprise/status": {
          get: {
            summary: "Get API status and configuration",
            description: "Returns information about your API key, permissions, and rate limits",
            tags: ["General"],
            responses: {
              "200": {
                description: "API status information",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        service: { type: "string", example: "GameVibe Enterprise API" },
                        version: { type: "string", example: "v1.0.0" },
                        apiKey: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            organization: { type: "string" },
                            tier: { type: "string", enum: ["STARTER", "PRO", "ENTERPRISE"] },
                            permissions: {
                              type: "array",
                              items: { "$ref": "#/components/schemas/APIPermission" }
                            },
                            rateLimits: { "$ref": "#/components/schemas/RateLimit" }
                          }
                        },
                        endpoints: {
                          type: "object",
                          additionalProperties: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/api/v1/enterprise/games": {
          get: {
            summary: "List games",
            description: "Retrieve a paginated list of games for your organization",
            tags: ["Games"],
            parameters: [
              {
                name: "limit",
                in: "query",
                description: "Number of games to return (max 1000)",
                schema: { type: "integer", minimum: 1, maximum: 1000, default: 50 }
              },
              {
                name: "offset", 
                in: "query",
                description: "Number of games to skip",
                schema: { type: "integer", minimum: 0, default: 0 }
              },
              {
                name: "serverId",
                in: "query", 
                description: "Filter by Discord server ID",
                schema: { type: "string" }
              },
              {
                name: "status",
                in: "query",
                description: "Filter by game status",
                schema: { type: "string", enum: ["active", "inactive", "draft"] }
              }
            ],
            responses: {
              "200": {
                description: "List of games",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        games: {
                          type: "array",
                          items: { "$ref": "#/components/schemas/Game" }
                        },
                        pagination: { "$ref": "#/components/schemas/Pagination" }
                      }
                    }
                  }
                }
              }
            }
          },
          post: {
            summary: "Create a new game",
            description: "Generate a new game using AI",
            tags: ["Games"],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { "$ref": "#/components/schemas/CreateGameRequest" }
                }
              }
            },
            responses: {
              "201": {
                description: "Game created successfully",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        game: { "$ref": "#/components/schemas/Game" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/api/v1/enterprise/games/{gameId}": {
          get: {
            summary: "Get game details",
            description: "Retrieve detailed information about a specific game",
            tags: ["Games"],
            parameters: [
              {
                name: "gameId",
                in: "path",
                required: true,
                description: "Game ID",
                schema: { type: "string" }
              }
            ],
            responses: {
              "200": {
                description: "Game details",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        game: { "$ref": "#/components/schemas/Game" }
                      }
                    }
                  }
                }
              },
              "404": {
                description: "Game not found"
              }
            }
          },
          put: {
            summary: "Update game",
            description: "Update game metadata and settings",
            tags: ["Games"],
            parameters: [
              {
                name: "gameId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { "$ref": "#/components/schemas/UpdateGameRequest" }
                }
              }
            },
            responses: {
              "200": {
                description: "Game updated successfully"
              }
            }
          },
          delete: {
            summary: "Delete game",
            description: "Permanently delete a game",
            tags: ["Games"],
            parameters: [
              {
                name: "gameId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            responses: {
              "204": {
                description: "Game deleted successfully"
              }
            }
          }
        },
        "/api/v1/enterprise/analytics/overview": {
          get: {
            summary: "Get analytics overview",
            description: "Retrieve high-level analytics for your organization",
            tags: ["Analytics"],
            parameters: [
              {
                name: "timeframe",
                in: "query",
                description: "Time period for analytics",
                schema: { type: "string", enum: ["1d", "7d", "30d", "90d"], default: "30d" }
              }
            ],
            responses: {
              "200": {
                description: "Analytics overview",
                content: {
                  "application/json": {
                    schema: { "$ref": "#/components/schemas/AnalyticsOverview" }
                  }
                }
              }
            }
          }
        },
        "/api/v1/enterprise/analytics/games/{gameId}": {
          get: {
            summary: "Get game analytics",
            description: "Retrieve detailed analytics for a specific game",
            tags: ["Analytics"],
            parameters: [
              {
                name: "gameId",
                in: "path",
                required: true,
                schema: { type: "string" }
              },
              {
                name: "timeframe",
                in: "query",
                schema: { type: "string", enum: ["1d", "7d", "30d", "90d"], default: "30d" }
              },
              {
                name: "metrics",
                in: "query",
                description: "Comma-separated list of metrics",
                schema: { type: "string", example: "plays,users,scores" }
              }
            ],
            responses: {
              "200": {
                description: "Game analytics",
                content: {
                  "application/json": {
                    schema: { "$ref": "#/components/schemas/GameAnalytics" }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "API Key",
            description: "Enter your GameVibe Enterprise API key"
          }
        },
        schemas: {
          Game: {
            type: "object",
            properties: {
              id: { type: "string", example: "game_123" },
              name: { type: "string", example: "Space Adventure" },
              description: { type: "string", example: "An epic space exploration game" },
              type: { type: "string", enum: ["platformer", "puzzle", "shooter", "rpg", "endless-runner"] },
              status: { type: "string", enum: ["active", "inactive", "draft"] },
              serverId: { type: "string", example: "discord_server_123" },
              creatorId: { type: "string", example: "user_123" },
              playCount: { type: "integer", example: 1500 },
              lastPlayed: { type: "string", format: "date-time" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              gameUrl: { type: "string", example: "https://gamevibe.ai/play/game_123" },
              thumbnailUrl: { type: "string", example: "https://cdn.gamevibe.ai/thumbnails/game_123.png" },
              metadata: {
                type: "object",
                additionalProperties: true
              }
            }
          },
          CreateGameRequest: {
            type: "object",
            required: ["name", "description", "type"],
            properties: {
              name: { type: "string", example: "My Awesome Game" },
              description: { type: "string", example: "A fun platformer game with unique mechanics" },
              type: { type: "string", enum: ["platformer", "puzzle", "shooter", "rpg", "endless-runner"] },
              serverId: { type: "string", example: "discord_server_123" },
              isPublic: { type: "boolean", default: true },
              metadata: {
                type: "object",
                additionalProperties: true
              }
            }
          },
          UpdateGameRequest: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              status: { type: "string", enum: ["active", "inactive", "draft"] },
              isPublic: { type: "boolean" },
              metadata: {
                type: "object",
                additionalProperties: true
              }
            }
          },
          APIPermission: {
            type: "object",
            properties: {
              resource: { type: "string", example: "games" },
              actions: {
                type: "array",
                items: { type: "string" },
                example: ["read", "write"]
              },
              scope: { type: "string", enum: ["own", "organization", "global"] }
            }
          },
          RateLimit: {
            type: "object",
            properties: {
              requestsPerMinute: { type: "integer", example: 100 },
              requestsPerHour: { type: "integer", example: 1000 },
              requestsPerDay: { type: "integer", example: 10000 },
              burstLimit: { type: "integer", example: 10 }
            }
          },
          Pagination: {
            type: "object",
            properties: {
              total: { type: "integer", example: 150 },
              limit: { type: "integer", example: 50 },
              offset: { type: "integer", example: 0 },
              hasMore: { type: "boolean", example: true }
            }
          },
          AnalyticsOverview: {
            type: "object",
            properties: {
              totalGames: { type: "integer", example: 25 },
              totalPlays: { type: "integer", example: 15000 },
              totalUsers: { type: "integer", example: 3200 },
              averageSessionTime: { type: "number", example: 245.5 },
              topGames: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    gameId: { type: "string" },
                    name: { type: "string" },
                    plays: { type: "integer" }
                  }
                }
              },
              dailyStats: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string", format: "date" },
                    plays: { type: "integer" },
                    users: { type: "integer" }
                  }
                }
              }
            }
          },
          GameAnalytics: {
            type: "object",
            properties: {
              gameId: { type: "string" },
              plays: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string", format: "date" },
                    count: { type: "integer" }
                  }
                }
              },
              users: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string", format: "date" },
                    uniqueUsers: { type: "integer" }
                  }
                }
              },
              scores: {
                type: "object",
                properties: {
                  average: { type: "number" },
                  highest: { type: "number" },
                  distribution: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        range: { type: "string" },
                        count: { type: "integer" }
                      }
                    }
                  }
                }
              }
            }
          },
          Error: {
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid request" },
              code: { type: "string", example: "INVALID_REQUEST" },
              details: {
                type: "object",
                additionalProperties: true
              }
            }
          }
        }
      },
      tags: [
        {
          name: "General",
          description: "General API information and status"
        },
        {
          name: "Games",
          description: "Game management operations"
        },
        {
          name: "Analytics",
          description: "Analytics and reporting"
        },
        {
          name: "Users",
          description: "User management operations"
        },
        {
          name: "Leaderboards",
          description: "Leaderboard and scoring operations"
        },
        {
          name: "Webhooks",
          description: "Webhook configuration and management"
        }
      ]
    };
  }

  private generatePostmanCollection(): any {
    return {
      info: {
        name: "GameVibe Enterprise API",
        description: "Complete Postman collection for GameVibe Enterprise API",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      auth: {
        type: "bearer",
        bearer: [
          {
            key: "token",
            value: "{{API_KEY}}",
            type: "string"
          }
        ]
      },
      variable: [
        {
          key: "baseUrl",
          value: "https://api.gamevibe.ai",
          type: "string"
        },
        {
          key: "API_KEY",
          value: "your_api_key_here",
          type: "string"
        }
      ],
      item: [
        {
          name: "General",
          item: [
            {
              name: "Get API Status",
              request: {
                method: "GET",
                header: [],
                url: {
                  raw: "{{baseUrl}}/api/v1/enterprise/status",
                  host: ["{{baseUrl}}"],
                  path: ["api", "v1", "enterprise", "status"]
                },
                description: "Get API status and your key information"
              }
            }
          ]
        },
        {
          name: "Games",
          item: [
            {
              name: "List Games",
              request: {
                method: "GET",
                header: [],
                url: {
                  raw: "{{baseUrl}}/api/v1/enterprise/games?limit=50&offset=0",
                  host: ["{{baseUrl}}"],
                  path: ["api", "v1", "enterprise", "games"],
                  query: [
                    {
                      key: "limit",
                      value: "50"
                    },
                    {
                      key: "offset", 
                      value: "0"
                    }
                  ]
                }
              }
            },
            {
              name: "Create Game",
              request: {
                method: "POST",
                header: [
                  {
                    key: "Content-Type",
                    value: "application/json"
                  }
                ],
                body: {
                  mode: "raw",
                  raw: JSON.stringify({
                    name: "My Test Game",
                    description: "A test game created via API",
                    type: "platformer",
                    serverId: "your_server_id",
                    isPublic: true
                  }, null, 2)
                },
                url: {
                  raw: "{{baseUrl}}/api/v1/enterprise/games",
                  host: ["{{baseUrl}}"],
                  path: ["api", "v1", "enterprise", "games"]
                }
              }
            },
            {
              name: "Get Game",
              request: {
                method: "GET",
                header: [],
                url: {
                  raw: "{{baseUrl}}/api/v1/enterprise/games/{{gameId}}",
                  host: ["{{baseUrl}}"],
                  path: ["api", "v1", "enterprise", "games", "{{gameId}}"]
                }
              }
            }
          ]
        },
        {
          name: "Analytics",
          item: [
            {
              name: "Get Analytics Overview",
              request: {
                method: "GET",
                header: [],
                url: {
                  raw: "{{baseUrl}}/api/v1/enterprise/analytics/overview?timeframe=30d",
                  host: ["{{baseUrl}}"],
                  path: ["api", "v1", "enterprise", "analytics", "overview"],
                  query: [
                    {
                      key: "timeframe",
                      value: "30d"
                    }
                  ]
                }
              }
            },
            {
              name: "Get Game Analytics",
              request: {
                method: "GET",
                header: [],
                url: {
                  raw: "{{baseUrl}}/api/v1/enterprise/analytics/games/{{gameId}}?timeframe=30d&metrics=plays,users,scores",
                  host: ["{{baseUrl}}"],
                  path: ["api", "v1", "enterprise", "analytics", "games", "{{gameId}}"],
                  query: [
                    {
                      key: "timeframe",
                      value: "30d"
                    },
                    {
                      key: "metrics",
                      value: "plays,users,scores"
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    };
  }
}