const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Plane = sequelize.define("Plane", {
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
    type: DataTypes.ENUM("Root", "Dependence"),
    allowNull: false
  },

  parent_id: {
    type: DataTypes.STRING(5),
    allowNull: true
  },

  image: {
    type: DataTypes.STRING(500),
    allowNull: true
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "planes",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at"
});

module.exports = Plane;
