import React, { type ReactNode } from "react";
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

export function Layout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>PontoFlex</Heading>
          {children}
          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0 12px" }} />
          <Text style={muted}>PontoFlex · um produto NOMANDUZ - TECH and IA</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
export const container = { padding: "24px 28px", maxWidth: "520px" };
export const h1 = { color: "#0f3d3e", fontSize: "22px", margin: "0 0 16px" };
export const text = { color: "#1f2937", fontSize: "15px", lineHeight: "22px" };
export const box = {
  backgroundColor: "#f1f5f4",
  borderRadius: "8px",
  padding: "12px",
  textAlign: "center" as const,
};
export const code = {
  fontSize: "26px",
  letterSpacing: "4px",
  fontWeight: "bold",
  color: "#0f3d3e",
  margin: 0,
  fontFamily: "Consolas, monospace",
};
export const muted = { color: "#6b7280", fontSize: "13px", marginTop: "12px" };
export const button = {
  backgroundColor: "#0f3d3e",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: "bold",
  display: "inline-block",
};
export const row = { color: "#1f2937", fontSize: "14px", lineHeight: "20px", margin: "2px 0" };
