import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import PortalFloaters from "../components/PortalFloaters";

export default function ProjectHeadPortal() {

  const [user, setUser] =
    useState(null);

  useEffect(() => {

    const storedUser =
      localStorage.getItem("user");

    if (storedUser) {

      const parsedUser =
        JSON.parse(storedUser);

      console.log(
        "Portal User:",
        parsedUser
      );

      setUser(parsedUser);
    }

  }, []);

  if (!user) {
    return <h2>Loading...</h2>;
  }

  return (
    <div>

      <Navbar />

      <div
        style={{
          maxWidth: "900px",
          margin: "40px auto",
          padding: "24px"
        }}
      >

        <h1>
          Head Portal
        </h1>

        <div
        style={{
          background: "#fff",
          padding: "24px",
          borderRadius: "16px",
          borderTop: "6px solid #00a896",
          boxShadow: "0 10px 30px rgba(0, 168, 150, 0.12)"
        }}
        >

          <h2>
            {user.name}
          </h2>

          <p>
            <strong>
              Username:
            </strong>
            {" "}
            {user.user_name}
          </p>

          <p>
            <strong>
              Department:
            </strong>
            {" "}
            {user.role}
          </p>

          <p>
            <strong>
              Designation:
            </strong>
            {" "}
            {user.designation}
          </p>

          <p>
            <strong>
              Site:
            </strong>
            {" "}
            {user.site_name || "Not Assigned"}
          </p>

          <p>
            <strong>
              Role:
            </strong>
            {" "}
            {user.role || "Not Assigned"}
          </p>

        </div>

      </div>

      <PortalFloaters showBot />

    </div>
  );
}