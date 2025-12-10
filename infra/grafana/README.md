# Grafana Dashboard Configuration

This directory contains Grafana dashboard configurations for monitoring the WhatsApp Cashflow Bot.

## Dashboard Overview

### System Overview Dashboard (`system-overview-dashboard.json`)

A comprehensive dashboard for monitoring all aspects of the WhatsApp Cashflow Bot.

**Panels Included:**

1. **Total Messages Received** (Gauge)
   - Metric: `whatsapp_cashflow_messages_received_total`
   - Shows total messages received since startup

2. **Message Processing Time** (Time Series)
   - Metric: `whatsapp_cashflow_message_processing_duration_seconds`
   - Shows p95 and p50 processing times in milliseconds
   - Target: <2000ms for p95

3. **Transactions by Status** (Time Series)
   - Metric: `whatsapp_cashflow_transactions_processed_total`
   - Shows approved, pending, and rejected transactions
   - Segmented by status

4. **Cache Hit Ratio** (Gauge)
   - Formula: `(cache_hits / (cache_hits + cache_misses)) * 100`
   - Target: >80% hit ratio
   - Green: >95%, Orange: >80%, Red: <80%

5. **Database Query Time** (Time Series)
   - Metric: `whatsapp_cashflow_database_query_duration_seconds`
   - Shows p95 and p50 query times in milliseconds
   - Target: <500ms for p95

6. **Error Rate by Handler** (Time Series)
   - Metric: `whatsapp_cashflow_message_processing_errors_total`
   - Shows error rate per handler
   - Helps identify problematic handlers

7. **Active Employees** (Gauge)
   - Metric: `whatsapp_cashflow_active_users_total{role="employee"}`
   - Shows number of active employee users
   - Thresholds: Green <10, Yellow <20, Red >20

8. **WhatsApp Status** (Gauge)
   - Metric: `whatsapp_cashflow_whatsapp_session_status`
   - Values: 0 (Disconnected), 1 (Connected)
   - Critical metric for system health

9. **Pending Transactions** (Gauge)
   - Metric: `whatsapp_cashflow_pending_transactions_total`
   - Shows transactions awaiting approval
   - Thresholds: Green <5, Yellow <10, Red >10

10. **Reports Generated** (Time Series)
    - Metric: `whatsapp_cashflow_reports_generated_total`
    - Shows daily and monthly reports
    - Useful for tracking report delivery

## Setup Instructions

### Prerequisites

- Prometheus server running and scraping metrics from the bot
- Grafana server installed and running
- Bot health check endpoint accessible at `/metrics`

### Installation Steps

#### 1. Configure Prometheus Data Source

1. Open Grafana (default: http://localhost:3000)
2. Navigate to **Configuration > Data Sources**
3. Click **Add data source**
4. Select **Prometheus**
5. Configure:
   - **Name:** `Prometheus`
   - **URL:** `http://localhost:9090` (or your Prometheus URL)
   - **Access:** `Server (default)`
6. Click **Save & Test**

#### 2. Import Dashboard

**Option A: Via UI**

1. Navigate to **Dashboards > Import**
2. Click **Upload JSON file**
3. Select `system-overview-dashboard.json`
4. Select **Prometheus** as the data source
5. Click **Import**

**Option B: Via API**

```bash
# Import dashboard via Grafana API
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @system-overview-dashboard.json
```

**Option C: Copy to Grafana Provisioning**

```bash
# Copy to Grafana provisioning directory
sudo cp system-overview-dashboard.json /etc/grafana/provisioning/dashboards/

# Restart Grafana
sudo systemctl restart grafana-server
```

#### 3. Configure Prometheus Scrape Config

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "whatsapp-cashflow-bot"
    scrape_interval: 15s
    static_configs:
      - targets: ["localhost:3000"] # Bot metrics endpoint
    metrics_path: "/metrics"
```

Reload Prometheus:

```bash
curl -X POST http://localhost:9090/-/reload
```

### Docker Setup

If running with Docker Compose (see `docker/docker-compose.yml`):

```yaml
version: "3.8"

services:
  # ... other services ...

  prometheus:
    image: prom/prometheus:latest
    container_name: cashflow-prometheus
    volumes:
      - ./docker/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
    networks:
      - cashflow-network

  grafana:
    image: grafana/grafana:latest
    container_name: cashflow-grafana
    volumes:
      - grafana-data:/var/lib/grafana
      - ./infra/grafana:/etc/grafana/provisioning/dashboards:ro
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    networks:
      - cashflow-network

volumes:
  prometheus-data:
  grafana-data:

networks:
  cashflow-network:
    driver: bridge
```

Start services:

```bash
docker-compose -f docker/docker-compose.yml up -d prometheus grafana
```

## Dashboard Usage

### Accessing the Dashboard

1. Open Grafana: http://localhost:3000 (or 3001 if using Docker)
2. Login (default: admin/admin)
3. Navigate to **Dashboards > WhatsApp Cashflow Bot - System Overview**

### Time Range Selection

- Default: Last 6 hours
- Recommended: Last 24 hours for daily patterns
- Use custom range for historical analysis

### Key Metrics to Monitor

**Health Indicators:**

- ✅ WhatsApp Status: Should be "Connected" (1)
- ✅ Cache Hit Ratio: Should be >80%
- ✅ Message Processing Time p95: Should be <2000ms
- ✅ Database Query Time p95: Should be <500ms

**Performance Indicators:**

- 📊 Total Messages Received: Growing linearly
- 📊 Transactions Processed: Steady increase
- 📊 Error Rate: Should be near zero

**Operational Indicators:**

- 👥 Active Employees: Track user engagement
- ⏳ Pending Transactions: Should not accumulate
- 📄 Reports Generated: Daily reports at 24:00

### Alerts Configuration

#### Recommended Alerts

1. **WhatsApp Disconnected**
   - Condition: `whatsapp_cashflow_whatsapp_session_status == 0`
   - Severity: Critical
   - Action: Auto-reconnect and notify Dev

2. **High Error Rate**
   - Condition: `rate(whatsapp_cashflow_message_processing_errors_total[5m]) > 0.1`
   - Severity: High
   - Action: Investigate error logs

3. **Slow Message Processing**
   - Condition: `histogram_quantile(0.95, rate(whatsapp_cashflow_message_processing_duration_seconds_bucket[5m])) > 2`
   - Severity: Medium
   - Action: Check system resources

4. **Low Cache Hit Ratio**
   - Condition: `(whatsapp_cashflow_cache_hits_total / (whatsapp_cashflow_cache_hits_total + whatsapp_cashflow_cache_misses_total)) < 0.8`
   - Severity: Low
   - Action: Review cache TTL settings

5. **Pending Transactions Accumulating**
   - Condition: `whatsapp_cashflow_pending_transactions_total > 10`
   - Severity: Medium
   - Action: Notify Boss for approval

#### Setting Up Alerts

1. Navigate to **Alerting > Alert rules**
2. Click **New alert rule**
3. Configure:
   - **Query:** Use PromQL expressions above
   - **Condition:** Set threshold
   - **Evaluation:** Set interval (e.g., 1m)
   - **Notification:** Configure channels (email, Slack, etc.)

## Customization

### Adding New Panels

1. Open the dashboard
2. Click **Add panel**
3. Configure:
   - **Query:** Select Prometheus metric
   - **Visualization:** Choose panel type
   - **Thresholds:** Set appropriate values
4. Click **Apply**
5. Save dashboard

### Exporting Modified Dashboard

```bash
# Export dashboard
curl -X GET http://localhost:3000/api/dashboards/uid/whatsapp-cashflow-bot \
  -H "Authorization: Bearer YOUR_API_KEY" \
  | jq '.dashboard' > system-overview-dashboard.json
```

## Troubleshooting

### Dashboard Not Showing Data

1. **Check Prometheus Target Status:**

   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

   - Ensure bot target is "UP"
   - Check scrape errors

2. **Verify Metrics Endpoint:**

   ```bash
   curl http://localhost:3000/metrics
   ```

   - Should return Prometheus metrics
   - Check for `whatsapp_cashflow_` prefix

3. **Check Grafana Data Source:**
   - Go to **Configuration > Data Sources > Prometheus**
   - Click **Save & Test**
   - Should show "Data source is working"

### Metrics Not Updating

1. **Check Bot Health:**

   ```bash
   curl http://localhost:3000/health
   ```

2. **Check Prometheus Scrape Interval:**
   - Default: 15 seconds
   - Adjust in `prometheus.yml` if needed

3. **Verify Time Range:**
   - Ensure dashboard time range includes recent data
   - Try "Last 5 minutes" for testing

### High Memory Usage

- **Prometheus:** Increase `--storage.tsdb.retention.time`
- **Grafana:** Reduce dashboard refresh rate
- **Bot:** Check for memory leaks in application

## Performance Targets

**Metrics Collection:**

- Scrape interval: 15 seconds
- Retention: 15 days (default)
- Storage: ~1GB per day

**Dashboard Performance:**

- Load time: <2 seconds
- Query time: <500ms
- Refresh interval: 30 seconds (default)

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Query Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)

## Support

For issues or questions:

1. Check bot health: `curl http://localhost:3000/health`
2. Review Prometheus targets: http://localhost:9090/targets
3. Check Grafana logs: `docker logs cashflow-grafana` (if using Docker)
4. Consult project documentation in `docs/`
