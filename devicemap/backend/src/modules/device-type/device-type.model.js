const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const DeviceType = sequelize.define("DeviceType", {
  id: {
    type: DataTypes.STRING(5),
    primaryKey: true,
    allowNull: false
  },

  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },

  type: {
    type: DataTypes.ENUM("Camera", "Sensor"),
    allowNull: false
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "device_types",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at"
});

module.exports = DeviceType;
