"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";

export default function PedidosComRotaRedirect() {
  useEffect(() => {
    redirect("/pedidos");
  }, []);

  return null;
}
