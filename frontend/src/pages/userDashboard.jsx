import { useCallback, useEffect, useState } from "react";
import { useToast } from "../components/Toaster";
import { authHeaders } from "../utils/auth";
import { useI18n } from "../utils/i18n";

const API = import.meta.env.VITE_API_URL;

const EMPTY_FORM = {
  name: "",
  category: "",
  price: "",
  upc: "",
  producer: "",
  image_url: "",
};

const UserDashboard = () => {
  const { t } = useI18n();
  return (
    <main className="users-page">
      <div className="users-card dashboard-card">
        <div className="users-card-body">
          <h1 className="users-title">{t("user Dashboard")}</h1>

          <p className="users-subtitle">
            <i>{t("manage the catalogue and stock.")}</i>
          </p>
        </div>
      </div>
    </main>
  );
}

export default UserDashboard;
