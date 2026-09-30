import HomeClient from "../../app/home-client"; // ถ้า dashboard อยู่ใน src/app/dashboard/

// ถ้า dashboard อยู่คนละที่ ใช้ absolute แบบนี้ก็ได้
// import HomeClient from "@/app/home-client";

export default function DashboardPage() {
  return <HomeClient />;
}