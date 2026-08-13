const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Monitor = sequelize.define("Monitor", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  plane_id: {
    type: DataTypes.STRING(5),
    allowNull: false
  },
  device_id: {
    type: DataTypes.STRING(5),
    allowNull: false
  },
  x: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  y: {
    type: DataTypes.FLOAT,
    allowNull: false
  }
}, {
  tableName: "monitors",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    {
      unique: true,
      fields: ["plane_id", "device_id"]
    },
    {
      fields: ["plane_id"]
    },
    {
      fields: ["device_id"]
    }
  ]
});

module.exports = Monitor;
