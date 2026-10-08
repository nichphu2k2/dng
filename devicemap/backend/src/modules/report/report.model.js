const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Report = sequelize.define("Report", {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  time_start: {
    type: DataTypes.STRING(15),
    allowNull: false,
    validate: {
      is: /^\d{8}_\d{6}$/
    }
  },
  time_end: {
    type: DataTypes.STRING(15),
    allowNull: false,
    validate: {
      is: /^\d{8}_\d{6}$/
    }
  },
  device_id: {
    type: DataTypes.STRING(5),
    allowNull: true,
    references: {
      model: "devices",
      key: "id"
    }
  },
  device_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  plane_id: {
    type: DataTypes.STRING(5),
    allowNull: true,
    references: {
      model: "planes",
      key: "id"
    }
  },
  plane_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  state: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
    validate: {
      isIn: [[0, 1, 2]]
    }
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    references: {
      model: "users",
      key: "id"
    }
  },
  user_full_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  confirmed_by_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    references: {
      model: "users",
      key: "id"
    }
  },
  confirmed_by_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "reports",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    {
      fields: ["device_id"]
    },
    {
      fields: ["plane_id"]
    },
    {
      fields: ["user_id"]
    },
    {
      fields: ["state"]
    },
    {
      fields: ["confirmed_by_id"]
    }
  ]
});

module.exports = Report;
