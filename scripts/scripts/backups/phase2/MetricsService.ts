/**
 * MetricsService provides functionality to collect and report
 * application metrics for monitoring and performance analysis
 */

// Types of metrics that can be collected
enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

// Interface for metric values
interface MetricValue {
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

// Interface for histogram buckets
interface HistogramBucket {
  le: number; // Less than or equal to
  count: number;
}

// Interface for histogram metrics
interface HistogramMetric extends MetricValue {
  type: MetricType.HISTOGRAM;
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

// Interface for summary metrics
interface SummaryMetric extends MetricValue {
  type: MetricType.SUMMARY;
  quantiles: Record<number, number>; // Map of quantile to value
  sum: number;
  count: number;
}

export class MetricsService {
  private static instance: MetricsService;
  private metrics: Map<string, MetricValue>;
  private startTime: number;
  
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
    
    // Initialize some default metrics
    this.setGauge('app_uptime_seconds', 0);
    this.setCounter('http_requests_total', 0);
    this.setCounter('http_requests_error_total', 0);
    this.setHistogram('http_request_duration_seconds', {
      buckets: [
        { le: 0.01, count: 0 },
        { le: 0.05, count: 0 },
        { le: 0.1, count: 0 },
        { le: 0.5, count: 0 },
        { le: 1, count: 0 },
        { le: 5, count: 0 },
        { le: 10, count: 0 },
        { le: Infinity, count: 0 }
      ],
      sum: 0,
      count: 0
    });
    
    // Update uptime metric every minute
    setInterval(() => {
      this.updateUptime();
    }, 60000);
    
    console.log('Metrics service initialized');
  }
  
  /**
   * Get the singleton instance of the metrics service
   */
  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }
  
  /**
   * Set a counter metric
   */
  public setCounter(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.set(name, {
      type: MetricType.COUNTER,
      value,
      labels,
      timestamp: Date.now()
    });
  }
  
  /**
   * Increment a counter metric
   */
  public incrementCounter(name: string, increment: number = 1, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (metric && metric.type === MetricType.COUNTER) {
      metric.value += increment;
      metric.timestamp = Date.now();
      if (labels) {
        metric.labels = { ...metric.labels, ...labels };
      }
    } else {
      this.setCounter(name, increment, labels);
    }
  }
  
  /**
   * Set a gauge metric
   */
  public setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.set(name, {
      type: MetricType.GAUGE,
      value,
      labels,
      timestamp: Date.now()
    });
  }
  
  /**
   * Set a histogram metric
   */
  public setHistogram(name: string, histogram: Omit<HistogramMetric, 'type' | 'value'>, labels?: Record<string, string>): void {
    this.metrics.set(name, {
      type: MetricType.HISTOGRAM,
      value: histogram.count,
      buckets: histogram.buckets,
      sum: histogram.sum,
      count: histogram.count,
      labels,
      timestamp: Date.now()
    } as HistogramMetric);
  }
  
  /**
   * Update a histogram with a new observation
   */
  public observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name) as HistogramMetric | undefined;
    
    if (metric && metric.type === MetricType.HISTOGRAM) {
      // Update buckets
      for (const bucket of metric.buckets) {
        if (value <= bucket.le) {
          bucket.count++;
        }
      }
      
      // Update sum and count
      metric.sum += value;
      metric.count++;
      metric.value = metric.count;
      metric.timestamp = Date.now();
      
      if (labels) {
        metric.labels = { ...metric.labels, ...labels };
      }
    } else {
      console.warn(`Histogram metric ${name} doesn't exist`);
    }
  }
  
  /**
   * Update the application uptime metric
   */
  private updateUptime(): void {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    this.setGauge('app_uptime_seconds', uptimeSeconds);
  }
  
  /**
   * Get all metrics
   */
  public getAllMetrics(): Map<string, MetricValue> {
    // Always update uptime when getting all metrics
    this.updateUptime();
    return this.metrics;
  }
  
  /**
   * Get a specific metric
   */
  public getMetric(name: string): MetricValue | undefined {
    return this.metrics.get(name);
  }
  
  /**
   * Record HTTP request metrics
   */
  public recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number
  ): void {
    // Increment total requests counter
    this.incrementCounter('http_requests_total', 1, {
      method,
      path,
      status: statusCode.toString()
    });
    
    // Increment error counter if status >= 400
    if (statusCode >= 400) {
      this.incrementCounter('http_requests_error_total', 1, {
        method,
        path,
        status: statusCode.toString()
      });
    }
    
    // Record request duration in histogram
    this.observeHistogram('http_request_duration_seconds', duration, {
      method,
      path,
      status: statusCode.toString()
    });
  }
  
  /**
   * Format metrics for Prometheus
   */
  public formatMetricsForPrometheus(): string {
    const lines: string[] = [];
    
    for (const [name, metric] of this.metrics.entries()) {
      // Add metric help and type
      lines.push(`# HELP ${name} ${this.getMetricHelp(name)}`);
      lines.push(`# TYPE ${name} ${metric.type}`);
      
      // Format based on metric type
      switch (metric.type) {
        case MetricType.COUNTER:
        case MetricType.GAUGE:
          lines.push(this.formatSimpleMetric(name, metric));
          break;
          
        case MetricType.HISTOGRAM:
          lines.push(...this.formatHistogramMetric(name, metric as HistogramMetric));
          break;
          
        case MetricType.SUMMARY:
          // Not implemented in this example
          break;
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Format a simple metric (counter or gauge)
   */
  private formatSimpleMetric(name: string, metric: MetricValue): string {
    const labelStr = this.formatLabels(metric.labels);
    return `${name}${labelStr} ${metric.value}`;
  }
  
  /**
   * Format a histogram metric
   */
  private formatHistogramMetric(name: string, metric: HistogramMetric): string[] {
    const labelStr = this.formatLabels(metric.labels);
    const lines: string[] = [];
    
    // Add bucket lines
    for (const bucket of metric.buckets) {
      lines.push(`${name}_bucket{${labelStr ? labelStr.slice(1, -1) + ',' : ''}le="${bucket.le}"} ${bucket.count}`);
    }
    
    // Add sum and count
    lines.push(`${name}_sum${labelStr} ${metric.sum}`);
    lines.push(`${name}_count${labelStr} ${metric.count}`);
    
    return lines;
  }
  
  /**
   * Format metric labels as a string
   */
  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    
    const labelPairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
      
    return `{${labelPairs}}`;
  }
  
  /**
   * Get help text for a metric
   */
  private getMetricHelp(name: string): string {
    // Define help text for known metrics
    const helpTexts: Record<string, string> = {
      'app_uptime_seconds': 'The uptime of the application in seconds',
      'http_requests_total': 'Total number of HTTP requests',
      'http_requests_error_total': 'Total number of HTTP requests resulting in errors (status >= 400)',
      'http_request_duration_seconds': 'HTTP request duration in seconds'
    };
    
    return helpTexts[name] || `Metric ${name}`;
  }
}