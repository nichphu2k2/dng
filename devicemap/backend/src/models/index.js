/**
 * Load all models for database synchronization
 */

const Device = require("../modules/device/device.model");
const DeviceType = require("../modules/device-type/device-type.model");
const Plane = require("../modules/plane/plane.model");
const Monitor = require("../modules/monitor/monitor.model");
const Report = require("../modules/report/report.model");
const Setting = require("../modules/settings/setting.model");
const User = require("../modules/user/user.model");
const UserSession = require("../modules/user/user-session.model");
const UserLog = require("../modules/user/user-log.model");

// Define associations
Device.belongsTo(DeviceType, { foreignKey: "device_type_id", onDelete: "RESTRICT" });
DeviceType.hasMany(Device, { foreignKey: "device_type_id", onDelete: "RESTRICT" });

Plane.hasMany(Plane, { foreignKey: "parent_id", onDelete: "CASCADE", as: "children" });
Plane.belongsTo(Plane, { foreignKey: "parent_id", as: "parent" });

Plane.hasMany(Monitor, { foreignKey: "plane_id", onDelete: "CASCADE" });
Monitor.belongsTo(Plane, { foreignKey: "plane_id", onDelete: "CASCADE" });

Device.hasMany(Monitor, { foreignKey: "device_id", onDelete: "CASCADE" });
Monitor.belongsTo(Device, { foreignKey: "device_id", onDelete: "CASCADE" });

Device.hasMany(Report, { foreignKey: "device_id", onDelete: "RESTRICT" });
Report.belongsTo(Device, { foreignKey: "device_id", onDelete: "RESTRICT" });

Plane.hasMany(Report, { foreignKey: "plane_id", onDelete: "RESTRICT" });
Report.belongsTo(Plane, { foreignKey: "plane_id", onDelete: "RESTRICT" });

User.hasMany(Report, { foreignKey: "user_id", onDelete: "RESTRICT" });
Report.belongsTo(User, { foreignKey: "user_id", onDelete: "RESTRICT" });

User.hasMany(UserSession, { foreignKey: "user_id", onDelete: "CASCADE" });
UserSession.belongsTo(User, { foreignKey: "user_id", onDelete: "CASCADE" });

User.hasMany(UserLog, { foreignKey: "user_id", onDelete: "SET NULL" });
UserLog.belongsTo(User, { foreignKey: "user_id", onDelete: "SET NULL" });

module.exports = {
  Device,
  DeviceType,
  Plane,
  Monitor,
  Report,
  Setting,
  User,
  UserSession,
  UserLog
};
