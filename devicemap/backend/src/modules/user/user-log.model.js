const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const UserLog = sequelize.define("UserLog", {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  user_status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  session_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  session_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  action: {
    type: DataTypes.ENUM(
      "CREATE_USER",
      "UPDATE_USER",
      "DELETE_USER",
      "LOGIN",
      "LOGOUT",
      "CHANGE_PASSWORD"
    ),
    allowNull: false
  },
  action_by: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: "user_logs",
  timestamps: false
});

module.exports = UserLog;
