import styled from "styled-components";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import Table from "./Table.jsx";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Backdrop, CircularProgress } from "@mui/material";
import { getMachineDetail } from "@/services/machine.js";
import { signToken, checkIfPrepared } from "@/services/order.js";
import Countdown from "./Countdown.jsx";

function OrderList({ className, list, loading, reloadFunc }) {
  const navigate = useNavigate();
  const wallet = useAnchorWallet();
  const [isLoading, setIsLoading] = useState(loading);
  const [signing, setSigning] = useState(false);
  const handleConsole = async (order, deploy) => {
    const machine = await getMachineDetail(
      order.Metadata.MachineInfo.Provider,
      order.Metadata.MachineInfo.Uuid || order.Metadata.MachineInfo.UUID
    );
    setSigning(true);
    const href = await signToken(
      machine.IP,
      machine.Port,
      wallet.publicKey.toString(),
      deploy
    );
    window.open(href);
    setSigning(false);
  };
  let columns = [
    {
      title: "Time",
      width: "10%",
      key: "BuyTime",
      render: (text, record, index) => (
        <div className="time">
          <div className="y">
            {moment(record.OrderTime).format("YYYY.MM.DD")}
          </div>
          <div className="h">{moment(record.OrderTime).format("HH:mm:ss")}</div>
        </div>
      ),
    },
    {
      title: "Task Name",
      width: "14%",
      key: "TaskName",
      render: (text, record, index) =>
        record.Metadata?.formData?.taskName || "--",
    },
    {
      title: "DIST / hr",
      width: "10%",
      key: "Price",
      render: (text, record, index) => (
        <div className="price">
          <span>{record.Price}</span>
        </div>
      ),
    },
    {
      title: "Total",
      width: "10%",
      key: "Total",
      render: (text, record, index) => (
        <div className="price">
          <span className="token" />
          <label>{text}</label>
        </div>
      ),
    },
    {
      title: "Remaining Time",
      width: "14%",
      key: "StartTime",
      render: (text, record, index) => {
        if (record.StatusName === "Available") {
          return (
            <Countdown
              deadlineTime={new Date(record.EndTime).getTime()}
              onEnd={() => {
                console.log("Order ended.");
                reloadFunc();
              }}
            />
          );
        } else if (record.StatusName !== "Preparing") {
          return <span>00:00:00</span>;
        } else {
          return "";
        }
      },
    },
    {
      title: "Status",
      width: "10%",
      key: "StatusName",
      render: (text, record, index) => {
        if (text === "Preparing") {
          return <CircularProgress sx={{ color: "#ffffff" }} />;
        }
        return <div className={text}>{text}</div>;
      },
    },
    {
      title: "",
      width: "10%",
      key: "Uuid",
      render: (text, record, index) => (
        <div className="btns">
          <span
            onClick={() => {
              handleConsole(
                record,
                record.Metadata.OrderInfo.Intent === "deploy"
              );
            }}
            className={`mini-btn ${
              record.StatusName !== "Available" && "disabled"
            }`}>
            {record.Metadata.OrderInfo?.Intent &&
            record.Metadata.OrderInfo.Intent === "deploy"
              ? "Deployment"
              : "Console"}
          </span>
          <span
            onClick={() => navigate("/order/" + text)}
            className={`mini-btn${
              record.StatusName === "Preparing" ? " disabled" : ""
            }`}>
            Detail
          </span>
        </div>
      ),
    },
  ];
  useEffect(() => {
    setIsLoading(loading);
  }, [loading]);
  useEffect(() => {
    const timers = [];

    for (const item of list) {
      if (item.StatusName === "Preparing") {
        const timer = setInterval(async () => {
          const prepared = await checkIfPrepared(item);
          if (prepared) {
            clearInterval(timer);
            reloadFunc();
          }
        }, 3000);
        timers.push(timer);
      }
    }

    return () => {
      timers.forEach((timer) => clearInterval(timer));
    };
  }, [list]);
  return (
    <div className={className}>
      <Table
        className="order-table"
        columns={columns}
        list={list}
        empty={<span>No item yet</span>}
        loading={isLoading}
      />
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={signing}>
        <CircularProgress />
      </Backdrop>
    </div>
  );
}

export default styled(OrderList)`
  .order-table {
    tr td {
      padding: 20px 10px !important;
    }
  }
  .spin-box {
    width: 100%;
    height: 50px;
    padding: 100px 0;
    display: block;
    overflow: hidden;
    text-align: center;
  }
  .price {
    display: flex;
    clear: both;
    flex-direction: row;
    align-items: center;
    img {
      width: 20px;
    }
    span {
      color: #ffffff;
      line-height: 20px;
      margin-right: 8px;
    }
  }
  .total {
    display: flex;
    flex-direction: column;
    span {
      padding: 1px;
      background-color: #000;
      color: #797979;
      font-size: 12px;
      border-radius: 6px;
      width: 31px;
      text-align: center;
    }
  }
  .status-Available {
    color: #bdff95;
  }
  .status-Completed {
    color: #878787;
  }
  .status-Refunded {
    color: #ffb9b9;
  }
  .btns {
    display: flex;
    justify-content: space-between;
  }
  .disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  .disabled:hover {
    opacity: 0.5 !important;
  }
  .mini-btn {
    border-radius: 4px;
    border: none;
    height: 31px;
    line-height: 31px;
    padding: 0 10px;
    font-size: 14px;
    display: block;
    text-align: center;
    overflow: hidden;
    margin-right: 10px;
    float: right;
    :hover {
      border: none;
    }
    background-image: linear-gradient(to right, #20ae98, #0aab50);
    color: white;
    cursor: pointer;
  }
  .token {
    margin: 0;
    border-radius: 100%;
    background-image: url(/img/token.png);
    background-size: 100%;
    background-position: center;
    background-repeat: no-repeat;
    width: 24px;
    height: 24px;
  }
`;
