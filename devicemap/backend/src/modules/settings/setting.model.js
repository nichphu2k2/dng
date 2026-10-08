const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Setting = sequelize.define("Setting", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  setting_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  setting_value: {
    type: DataTypes.JSON,
    allowNull: false
  }
}, {
  tableName: "settings",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    {
      unique: true,
      fields: ["setting_key"]
    }
  ]
});

module.exports = Setting;
