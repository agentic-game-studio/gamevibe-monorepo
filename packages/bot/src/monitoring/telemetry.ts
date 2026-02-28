import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { metrics, trace, SpanStatusCode } from '@opentelemetry/api';

export class TelemetryService {
  private sdk?: NodeSDK;
  private meter = metrics.getMeter('gamevibe-bot', '0.1.0');
  private tracer = trace.getTracer('gamevibe-bot', '0.1.0');
  
  // Metrics
  private gameGenerationCounter = this.meter.createCounter('gamevibe_games_generated_total', {
    description: 'Total number of games generated'
  });
  
  private gameGenerationDuration = this.meter.createHistogram('gamevibe_game_generation_duration_seconds', {
    description: 'Time taken to generate a game',
    unit: 's'
  });
  
  private activeUsersGauge = this.meter.createUpDownCounter('gamevibe_active_users', {
    description: 'Number of currently active users'
  });
  
  private commandCounter = this.meter.createCounter('gamevibe_commands_total', {
    description: 'Total number of Discord commands executed'
  });
  
  private errorCounter = this.meter.createCounter('gamevibe_errors_total', {
    description: 'Total number of errors'
  });

  initialize(config: {
    serviceName?: string;
    serviceVersion?: string;
    otlpEndpoint?: string;
    environment?: string;
  } = {}): void {
    const {
      serviceName = 'gamevibe-bot',
      serviceVersion = process.env.npm_package_version || '0.1.0',
      otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      environment = process.env.NODE_ENV || 'development'
    } = config;

    // Create resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || `${serviceName}-${process.pid}`
    });

    // Create exporters
    const traceExporter = new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`
    });

    const metricExporter = new OTLPMetricExporter({
      url: `${otlpEndpoint}/v1/metrics`
    });

    // Create SDK
    this.sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 30000 // Export every 30 seconds
      }) as any, // Type assertion to resolve compatibility issue
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable some noisy instrumentations
          '@opentelemetry/instrumentation-fs': {
            enabled: false
          }
        })
      ]
    });

    console.log(`📊 OpenTelemetry initialized - Service: ${serviceName}, Endpoint: ${otlpEndpoint}`);
  }

  start(): void {
    if (this.sdk) {
      this.sdk.start();
      console.log('📊 OpenTelemetry started');
    }
  }

  async stop(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('📊 OpenTelemetry stopped');
    }
  }

  // Metrics recording methods
  recordGameGenerated(gameType: string, duration: number): void {
    this.gameGenerationCounter.add(1, { game_type: gameType });
    this.gameGenerationDuration.record(duration / 1000, { game_type: gameType });
  }

  recordActiveUser(userId: string, increment: boolean = true): void {
    this.activeUsersGauge.add(increment ? 1 : -1, { user_id: userId });
  }

  recordCommand(commandName: string, success: boolean = true): void {
    this.commandCounter.add(1, { 
      command: commandName, 
      status: success ? 'success' : 'error' 
    });
  }

  recordError(errorType: string, source: string): void {
    this.errorCounter.add(1, { 
      error_type: errorType, 
      source: source 
    });
  }

  // Tracing methods
  startSpan(name: string, attributes?: Record<string, string | number>) {
    return this.tracer.startSpan(name, { attributes });
  }

  async executeWithSpan<T>(
    name: string, 
    fn: () => Promise<T>, 
    attributes?: Record<string, string | number>
  ): Promise<T> {
    const span = this.startSpan(name, attributes);
    
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    } finally {
      span.end();
    }
  }

  // Custom event recording
  recordCustomEvent(name: string, attributes: Record<string, string | number>): void {
    const span = this.tracer.startSpan(name);
    span.setAttributes(attributes);
    span.addEvent(name, attributes);
    span.end();
  }

  // Game-specific telemetry
  async recordGameGenerationTelemetry<T>(
    gameType: string,
    userId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    return this.executeWithSpan(
      'game_generation',
      async () => {
        const result = await fn();
        const duration = Date.now() - startTime;
        
        this.recordGameGenerated(gameType, duration);
        this.recordCustomEvent('game_generated', {
          game_type: gameType,
          user_id: userId,
          duration_ms: duration
        });
        
        return result;
      },
      {
        game_type: gameType,
        user_id: userId
      }
    );
  }

  // Discord command telemetry
  async recordCommandTelemetry<T>(
    commandName: string,
    userId: string,
    guildId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    return this.executeWithSpan(
      'discord_command',
      async () => {
        try {
          const result = await fn();
          const duration = Date.now() - startTime;
          
          this.recordCommand(commandName, true);
          this.recordCustomEvent('command_executed', {
            command: commandName,
            user_id: userId,
            guild_id: guildId,
            duration_ms: duration,
            status: 'success'
          });
          
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          this.recordCommand(commandName, false);
          this.recordError('command_error', commandName);
          this.recordCustomEvent('command_executed', {
            command: commandName,
            user_id: userId,
            guild_id: guildId,
            duration_ms: duration,
            status: 'error',
            error: error instanceof Error ? error.name : 'unknown'
          });
          
          throw error;
        }
      },
      {
        command: commandName,
        user_id: userId,
        guild_id: guildId
      }
    );
  }
}