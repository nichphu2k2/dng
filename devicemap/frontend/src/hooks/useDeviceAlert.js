import { useEffect, useState } from "react";
import socket from "../socket/socket";
import {
  getActiveAlarms,
  updateAllActiveReportProcessState,
  updateReportProcessState
} from "../api/report";

export default function useDeviceAlert() {
  const [alerts, setAlerts] = useState([]);

  const loadActiveAlerts = async () => {
    const res = await getActiveAlarms();
    const rows = Array.isArray(res?.data?.alarms) ? res.data.alarms : [];

    setAlerts(rows.map((item) => ({
      ...item,
      report_id: Number(item.report_id),
      status: "PENDING"
    })));
  };

  useEffect(() => {
    loadActiveAlerts().catch((err) => {
      console.error("Failed to load active alarms:", err);
    });

    const timer = window.setInterval(() => {
      loadActiveAlerts().catch(() => {
        // Keep current state if refresh fails.
      });
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onDeviceAlert = (payload) => {
      if (String(payload?.type || "") === "external_alarm_resolved") {
        const resolvedId = Number(payload?.report_id || 0);
        if (Number.isInteger(resolvedId) && resolvedId > 0) {
          setAlerts((prev) => prev.filter((item) => Number(item.report_id) !== resolvedId));
        }
        return;
      }

      if (String(payload?.type || "") !== "external_alarm") {
        return;
      }

      const reportId = Number(payload?.report_id || payload?.id || 0);
      if (!Number.isInteger(reportId) || reportId <= 0) {
        return;
      }

      setAlerts((prev) => {
        const filtered = prev.filter((item) => Number(item.report_id) !== reportId);
        return [{
          ...payload,
          report_id: reportId,
          status: "PENDING"
        }, ...filtered];
      });
    };

    socket.on("device_alert", onDeviceAlert);

    return () => socket.off("device_alert", onDeviceAlert);
  }, []);

  const resolveAlert = (reportId) => {
    setAlerts((prev) => prev.filter((item) => Number(item.report_id) !== Number(reportId)));
  };

  const pendingAlert = (reportId) => {
    setAlerts((prev) =>
      prev.map((item) =>
        Number(item.report_id) === Number(reportId) ? { ...item, status: "PENDING" } : item
      )
    );
  };

  const processAlert = async (reportId, state, description) => {
    const response = await updateReportProcessState(reportId, {
      state,
      description
    });

    resolveAlert(reportId);
    return response?.data;
  };

  const processAllAlerts = async (state, description = "") => {
    const response = await updateAllActiveReportProcessState({
      state,
      description
    });

    setAlerts([]);
    return response?.data;
  };

  return {
    alerts,
    resolveAlert,
    pendingAlert,
    processAlert,
    processAllAlerts,
    reloadAlerts: loadActiveAlerts
  };
}