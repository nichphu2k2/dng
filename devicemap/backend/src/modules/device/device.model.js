const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Device = sequelize.define("Device", {
  id: {
    type: DataTypes.STRING(5),
    primaryKey: true
  },

  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },

  device_type_id: {
    type: DataTypes.STRING(5),
    allowNull: false
  },

  device_type_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },

  status: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },

  rtsp1: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  rtsp1_status: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },

  rtsp2: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  rtsp2_status: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },

  modbus: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  pair: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },

  pair_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },

  link: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },

  icon1: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  icon2: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "devices",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at"
});

module.exports = Device;