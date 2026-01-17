import React, { useEffect } from "react";

const OpsRouteMap: React.FC = () => {
  useEffect(() => {
    console.warn("[OpsRouteMap] Deprecated: map is available only on /admin/routes/:routeId/map");
  }, []);
  return null;
};

export default OpsRouteMap;
