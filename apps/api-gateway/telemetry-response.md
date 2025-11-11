API :  /api/v1/telemetry/my-meter
RESPONSE : {
    "success": true,
    "message": "Latest reading retrieved successfully",
    "data": {
        "meter_id": "MTR-00000159",
        "region": "Delhi-South",
        "window_start": "2025-11-11T06:18:00.000Z",
        "avg_power_kw": 4.1935,
        "max_power_kw": 5.062,
        "energy_kwh_sum": 0.0698,
        "count": 6
    }
}

API : /api/v1/telemetry/my-meter/history?resolution=1m&start=2025-11-10T00:00:00Z&end=2025-11-11T23:59:59Z
RESPONSE : {
    "success": true,
    "message": "Meter history retrieved successfully",
    "data": {
        "meter_id": "MTR-00000159",
        "start_time": "2025-11-10T00:00:00.000Z",
        "end_time": "2025-11-11T23:59:59.000Z",
        "resolution": "1m",
        "data": [
            {
                "meter_id": "MTR-00000159",
                "region": "Delhi-South",
                "window_start": "2025-11-10T23:46:00.000Z",
                "avg_power_kw": 5.225,
                "max_power_kw": 5.237,
                "energy_kwh_sum": 0.029,
                "count": 2
            },
            {
                "meter_id": "MTR-00000159",
                "region": "Delhi-South",
                "window_start": "2025-11-10T23:47:00.000Z",
                "avg_power_kw": 5.183666666666666,
                "max_power_kw": 6.197,
                "energy_kwh_sum": 0.08629999999999999,
                "count": 6
            },
           ... ]}}

API : /api/v1/telemetry/my-meter/stats?start=2025-11-10T00:00:00Z&end=2025-11-11T23:59:59Z
RESPONSE : {
    "success": true,
    "message": "Consumption statistics retrieved successfully",
    "data": {
        "meter_id": "MTR-00000159",
        "period": {
            "start": "2025-11-10T00:00:00.000Z",
            "end": "2025-11-11T23:59:59.000Z"
        },
        "stats": {
            "total_consumption_kwh": 1.1475999999999997,
            "avg_power_kw": 5.16515,
            "max_power_kw": 6.197,
            "min_power_kw": 5.16515,
            "data_points": 80
        }
    }
}

API : /api/v1/telemetry/my-meter/daily?start_date=2025-11-01&end_date=2025-11-11
RESPONSE : {
    "success": true,
    "message": "Daily breakdown retrieved successfully",
    "data": {
        "meter_id": "MTR-00000159",
        "period": {
            "start": "2025-11-01",
            "end": "2025-11-11"
        },
        "breakdown": [
            {
                "date": "2025-11-09",
                "total_kwh": 1.1475999999999997,
                "avg_kw": 5.16515,
                "peak_kw": 6.197
            }
        ]
    }
}

API : /api/v1/telemetry/my-meter/monthly?start_month=2025-01&end_month=2025-11
RESPONSE : {
    "success": true,
    "message": "Monthly breakdown retrieved successfully",
    "data": {
        "meter_id": "MTR-00000159",
        "period": {
            "start": "2025-01",
            "end": "2025-11"
        },
        "breakdown": []
    }
}

API : /api/v1/telemetry/my-meter/compare?period1_start=2025-11-01T00:00:00Z&period1_end=2025-11-07T23:59:59Z&period2_start=2025-11-08T00:00:00Z&period2_end=2025-11-11T23:59:59Z
RESPONSE : {
    "success": false,
    "error": {
        "message": "No data found for this meter in the specified time range",
        "code": "NOT_FOUND",
        "stack": "Error: No data found for this meter in the specified time range\n    at getMeterStats (file:///private/tmp/smart-energy-grid/apps/api-gateway/dist/services/external/timescaleClient.js:45:15)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async Promise.all (index 0)\n    at async comparePeriods (file:///private/tmp/smart-energy-grid/apps/api-gateway/dist/services/external/timescaleClient.js:175:30)\n    at async file:///private/tmp/smart-energy-grid/apps/api-gateway/dist/controllers/telemetry/user.controller.js:105:24"
    }
}

API : /api/v1/telemetry/meters/MTR-00000159
RESPONSE : {
    "success": true,
    "message": "Meter reading retrieved successfully",
    "data": {
        "meter_id": "MTR-00000159",
        "region": "Delhi-South",
        "window_start": "2025-11-11T06:41:00.000Z",
        "avg_power_kw": 4.0680000000000005,
        "max_power_kw": 4.71,
        "energy_kwh_sum": 0.0679,
        "count": 6
    }
}

API : /api/v1/telemetry/meters/MTR-00000159/history?resolution=15m&start=2025-11-10T00:00:00Z&end=2025-11-11T23:59:59Z
RESPONSE : {
    "success": true,
    "message": "Meter history retrieved successfully",
    "data": {
        "meter_id": "MTR-00000159",
        "start_time": "2025-11-10T00:00:00.000Z",
        "end_time": "2025-11-11T23:59:59.000Z",
        "resolution": "15m",
        "data": [
            {
                "meter_id": "MTR-00000159",
                "region": "Delhi-South",
                "window_start": "2025-11-10T23:45:00.000Z",
                "avg_power_kw": 5.16515,
                "max_power_kw": 6.197,
                "energy_kwh_sum": 1.1475999999999997,
                "count": 80
            },
            {
                "meter_id": "MTR-00000159",
                "region": "Delhi-South",
                "window_start": "2025-11-11T06:15:00.000Z",
                "avg_power_kw": 4.411639534883721,
                "max_power_kw": 5.231,
                "energy_kwh_sum": 1.0533999999999997,
                "count": 86
            }
        ]
    }
}

API : /api/v1/telemetry/region/Delhi-South/stats?start=2025-11-10T00:00:00Z&end=2025-11-11T23:59:59Z
RESPONSE : {
    "success": true,
    "message": "Regional statistics retrieved successfully",
    "data": {
        "period": {
            "start": "2025-11-10T00:00:00.000Z",
            "end": "2025-11-11T23:59:59.000Z"
        },
        "stats": {
            "region": "Delhi-South",
            "total_consumption_kwh": 259.3789999999999,
            "active_meters": 125,
            "avg_consumption_per_meter": 2.0750319999999993,
            "peak_load_kw": 9.564
        }
    }
}

API : /api/v1/telemetry/region/Delhi-South/top-consumers?limit=10&start=2025-11-10T00:00:00Z&end=2025-11-11T23:59:59Z
RESPONSE : {
    "success": true,
    "message": "Top consumers retrieved successfully",
    "data": {
        "region": "Delhi-South",
        "period": {
            "start": "2025-11-10T00:00:00.000Z",
            "end": "2025-11-11T23:59:59.000Z"
        },
        "limit": 10,
        "consumers": [
            {
                "meter_id": "MTR-00000139",
                "total_kwh": 5.4674,
                "avg_kw": 7.580576970999595,
                "rank": 1
            },
            {
                "meter_id": "MTR-00000315",
                "total_kwh": 5.374900000000001,
                "avg_kw": 7.465544975179651,
                "rank": 2
            },
            {
                "meter_id": "MTR-00000051",
                "total_kwh": 5.233300000000002,
                "avg_kw": 7.226560117299073,
                "rank": 3
            },
            {
                "meter_id": "MTR-00000107",
                "total_kwh": 5.1154,
                "avg_kw": 7.123842681948695,
                "rank": 4
            },
            {
                "meter_id": "MTR-00000419",
                "total_kwh": 5.0288,
                "avg_kw": 6.995495474884983,
                "rank": 5
            },
            {
                "meter_id": "MTR-00000371",
                "total_kwh": 4.9997,
                "avg_kw": 7.007591302783502,
                "rank": 6
            },
            {
                "meter_id": "MTR-00000147",
                "total_kwh": 4.980499999999999,
                "avg_kw": 6.940835411874947,
                "rank": 7
            },
            {
                "meter_id": "MTR-00000431",
                "total_kwh": 4.9625,
                "avg_kw": 6.913544956916758,
                "rank": 8
            },
            {
                "meter_id": "MTR-00000279",
                "total_kwh": 4.875,
                "avg_kw": 6.742089427813565,
                "rank": 9
            },
            {
                "meter_id": "MTR-00000135",
                "total_kwh": 4.778899999999999,
                "avg_kw": 6.610911353876934,
                "rank": 10
            }
        ]
    }
}

API : /api/v1/telemetry/region/Delhi-South/realtime
RESPONSE : {
    "success": true,
    "message": "Real-time load retrieved successfully",
    "data": {
        "region": "Delhi-South",
        "current_load_kw": 2198.8338095238114,
        "active_meters": 125,
        "timestamp": "2025-11-11T06:58:00.000Z"
    }
}