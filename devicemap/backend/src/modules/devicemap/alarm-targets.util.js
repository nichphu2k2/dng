const Device = require("../device/device.model");
const DeviceType = require("../device-type/device-type.model");
const Monitor = require("../monitor/monitor.model");

const getMonitorPlaneDeviceIds = async (planeId) => {
  const rows = await Monitor.findAll({
    where: { plane_id: planeId },
    attributes: ["device_id"]
  });

  return [...new Set(rows.map((row) => String(row.device_id)))];
};

const buildAlarmTargets = async (deviceLike, planeId) => {
  const plainDevice = deviceLike?.toJSON ? deviceLike.toJSON() : deviceLike;
  const incomingDeviceId = String(plainDevice?.id || "");
  const incomingType = String(plainDevice?.DeviceType?.type || plainDevice?.type || "").toLowerCase();
  const planeDeviceIds = await getMonitorPlaneDeviceIds(planeId);
  const planeDeviceIdSet = new Set(planeDeviceIds);

  const flashDeviceIds = new Set(incomingDeviceId ? [incomingDeviceId] : []);
  const pairSensorIds = [];

  if (incomingType === "sensor") {
    const linkValue = Number(plainDevice?.link || 0);
    if (linkValue > 0) {
      const linkedRows = await Device.findAll({
        where: { link: linkValue },
        attributes: ["id"]
      });

      linkedRows.forEach((row) => {
        const rowId = String(row.id);
        if (planeDeviceIdSet.has(rowId)) {
          flashDeviceIds.add(rowId);
        }
      });
    }

    const pairValue = Number(plainDevice?.pair || 0);
    if (pairValue > 0) {
      const pairRows = await Device.findAll({
        include: [
          {
            model: DeviceType,
            attributes: ["type"]
          }
        ],
        where: { pair: pairValue },
        attributes: ["id"]
      });

      pairRows.forEach((row) => {
        const rowId = String(row.id);
        const rowType = String(row.DeviceType?.type || "").toLowerCase();
        if (rowType === "sensor" && planeDeviceIdSet.has(rowId)) {
          pairSensorIds.push(rowId);
          flashDeviceIds.add(rowId);
        }
      });
    }
  }

  return {
    incoming_device_type: incomingType,
    flash_device_ids: [...flashDeviceIds],
    pair_sensor_ids: [...new Set(pairSensorIds)]
  };
};

module.exports = {
  buildAlarmTargets
};
