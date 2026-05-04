import React from "react";

// Fixed left-rail navigation. Edit `links` to add or reorder pages.
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Overview", end: true },
  { to: "/stores", label: "Stores" },
  { to: "/promotions", label: "Promotions" },
  { to: "/transfers", label: "Transfers" },
  { to: "/customers", label: "Customers" },
  { to: "/conversion", label: "Conversion" },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo">Ven<span>mito</span></div>
        <div className="tagline">Insights Dashboard</div>
      </div>
      <ul className="sidebar-nav">
        {links.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to} end={l.end}>{l.label}</NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}
