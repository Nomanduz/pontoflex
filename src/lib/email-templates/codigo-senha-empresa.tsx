import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  codigo?: string
  empresa?: string
}

const Email = ({ codigo, empresa }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código para trocar a senha do PontoFlex</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>PontoFlex</Heading>
        <Text style={text}>Olá{empresa ? `, ${empresa}` : ''}!</Text>
        <Text style={text}>Use o código abaixo para confirmar a troca da senha de acesso da empresa. Ele vale por 15 minutos.</Text>
        <Section style={box}><Text style={code}>{codigo ?? '------'}</Text></Section>
        <Text style={muted}>Se você não pediu a troca de senha, ignore este e-mail. Sua senha atual continua valendo.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Código para trocar a senha — PontoFlex',
  displayName: 'Código de troca de senha da empresa',
  previewData: { codigo: '482913', empresa: 'Tech Minas' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '480px' }
const h1 = { color: '#0f3d3e', fontSize: '22px', margin: '0 0 16px' }
const text = { color: '#1f2937', fontSize: '15px', lineHeight: '22px' }
const box = { backgroundColor: '#f1f5f4', borderRadius: '8px', padding: '12px', textAlign: 'center' as const }
const code = { fontSize: '32px', letterSpacing: '8px', fontWeight: 'bold', color: '#0f3d3e', margin: 0 }
const muted = { color: '#6b7280', fontSize: '13px', marginTop: '20px' }
