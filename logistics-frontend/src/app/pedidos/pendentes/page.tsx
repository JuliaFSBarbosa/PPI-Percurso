"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";

export default function PedidosPendentesRedirect() {
  useEffect(() => {
    redirect("/pedidos");
  }, []);

  return null;
}
