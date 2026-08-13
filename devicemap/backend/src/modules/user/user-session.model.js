const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const UserSession = sequelize.define("UserSession", {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  session_token: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM("ACTIVE", "EXPIRED", "LOGOUT"),
    allowNull: false,
    defaultValue: "ACTIVE"
  },
  login_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_activity_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  logout_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expired_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: "user_sessions",
  timestamps: false
});

module.exports = UserSession;
