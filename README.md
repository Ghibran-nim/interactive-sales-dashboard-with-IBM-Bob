# 📊 Sales Analytics Dashboard 2024

An interactive, responsive, and lightweight sales analytics dashboard built with **HTML5**, **Tailwind CSS**, and **Vanilla JavaScript**. This project visualizes sales metrics, customer demographics, and regional performance dynamically parsed from a CSV data source.

> **Note**: Developed in collaboration with **Bob AI Agent**.

---

## ✨ Features

- **Dynamic Data Filtering**: Filter sales metrics in real-time by:
  - Region
  - Product Category
  - Customer Type (Retail vs. Wholesale)
  - Sales Channel (Online vs. Offline)
- **Key Performance Indicators (KPIs)**: Animated KPI cards displaying Total Revenue, Total Transactions, Total Units Sold, and Average Discount.
- **Interactive Visualizations**: Powered by **Chart.js**, featuring:
  - Monthly Sales Trend (Line Chart)
  - Revenue by Region (Polar Area Chart)
  - Revenue & Quantity by Product Category (Bar Charts)
  - Sales Representative Performance (Bar Chart)
  - Customer Type & Sales Channel Distribution (Pie Charts)
  - Payment Method Breakdown (Doughnut Chart)
  - Discount vs. Sales Correlation (Scatter Plot)
  - Top 10 Highest Value Transactions (Horizontal Bar Chart)
- **CSV Data Parsing**: Asynchronous CSV file reading using **PapaParse**.
- **Fully Responsive**: Mobile-first design styled with Tailwind CSS.

---

## 🛠️ Tech Stack

- **Frontend Markup**: HTML5
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (via CDN)
- **Scripting**: Vanilla JavaScript (ES6+)
- **Data Visualization**: [Chart.js](https://www.chartjs.org/)
- **CSV Parsing**: [PapaParse](https://www.papaparse.com/)

---

## 📁 Project Structure

```text
.
├── index.html       # Main HTML layout
├── style.css        # Custom styles and scrollbar overrides
├── script.js        # Core dashboard logic (Filtering, KPIs, Chart renderers)
└── sales_data.csv   # Dataset source
