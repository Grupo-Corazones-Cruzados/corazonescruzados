import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Definir estilos
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#1f2937",
  },
  header: {
    marginBottom: 30,
    borderBottom: "2px solid #dc2626",
    paddingBottom: 20,
  },
  logo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#dc2626",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  description: {
    fontSize: 11,
    color: "#4b5563",
    lineHeight: 1.5,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 10,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 6,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  infoItem: {
    width: "50%",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 12,
    color: "#111827",
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottom: "1px solid #d1d5db",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableCell: {
    fontSize: 10,
    color: "#374151",
  },
  colReq: {
    width: "50%",
  },
  colStatus: {
    width: "20%",
  },
  colCost: {
    width: "15%",
    textAlign: "right" as const,
  },
  colCreator: {
    width: "15%",
  },
  statusCompleted: {
    color: "#059669",
    fontWeight: "bold",
  },
  statusPending: {
    color: "#d97706",
  },
  teamMember: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  memberName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
  },
  memberRole: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 2,
  },
  memberAmount: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "bold",
    marginLeft: "auto",
  },
  totalBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#fef2f2",
    borderRadius: 4,
    borderLeft: "4px solid #dc2626",
  },
  totalLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#dc2626",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 9,
    borderTop: "1px solid #e5e7eb",
    paddingTop: 15,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#dc2626",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 10,
    color: "#6b7280",
  },
});

interface ProjectRequirement {
  titulo: string;
  descripcion?: string;
  costo?: number;
  completado: boolean;
  creador?: { nombre: string; tipo: string };
  miembro_completado?: { nombre: string };
}

interface TeamMember {
  nombre: string;
  puesto?: string;
  monto_acordado?: number;
}

interface ProjectPdfProps {
  project: {
    id: number;
    titulo: string;
    descripcion?: string;
    estado: string;
    fecha_limite?: string;
    created_at: string;
    presupuesto_min?: number;
    presupuesto_max?: number;
  };
  requirements: ProjectRequirement[];
  team: TeamMember[];
  propietario?: { nombre: string; tipo: string };
  clienteNombre?: string;
}

// Mapeo de estados a labels
const estadoLabels: Record<string, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  planificado: "Planificado",
  iniciado: "Iniciado",
  en_progreso: "En Progreso",
  en_implementacion: "En Implementacion",
  en_pruebas: "En Pruebas",
  completado: "Completado",
  completado_parcial: "Completado Parcial",
  no_completado: "No Completado",
  cancelado: "Cancelado",
};

export function ProjectPdfDocument({
  project,
  requirements,
  team,
  propietario,
  clienteNombre,
}: ProjectPdfProps) {
  const totalCost = requirements.reduce(
    (sum, r) => sum + Number(r.costo || 0),
    0
  );
  const completedReqs = requirements.filter((r) => r.completado).length;
  const totalReqs = requirements.length;
  const progress = totalReqs > 0 ? Math.round((completedReqs / totalReqs) * 100) : 0;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-EC", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Corazones Cruzados</Text>
          <Text style={styles.subtitle}>Reporte de Proyecto</Text>
        </View>

        {/* Project Title */}
        <Text style={styles.title}>{project.titulo}</Text>
        {project.descripcion && (
          <Text style={styles.description}>{project.descripcion}</Text>
        )}

        {/* Project Info Grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Proyecto ID</Text>
            <Text style={styles.infoValue}>#{project.id}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Estado</Text>
            <Text style={styles.infoValue}>
              {estadoLabels[project.estado] || project.estado}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Fecha de Creacion</Text>
            <Text style={styles.infoValue}>{formatDate(project.created_at)}</Text>
          </View>
          {project.fecha_limite && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fecha Limite</Text>
              <Text style={styles.infoValue}>
                {formatDate(project.fecha_limite)}
              </Text>
            </View>
          )}
          {propietario && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Propietario</Text>
              <Text style={styles.infoValue}>{propietario.nombre}</Text>
            </View>
          )}
          {clienteNombre && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Cliente</Text>
              <Text style={styles.infoValue}>{clienteNombre}</Text>
            </View>
          )}
          {project.presupuesto_min && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Presupuesto</Text>
              <Text style={styles.infoValue}>
                {formatCurrency(project.presupuesto_min)}
                {project.presupuesto_max
                  ? ` - ${formatCurrency(project.presupuesto_max)}`
                  : ""}
              </Text>
            </View>
          )}
        </View>

        {/* Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progreso</Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {completedReqs} de {totalReqs} requerimientos completados ({progress}%)
          </Text>
        </View>

        {/* Requirements */}
        {requirements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requerimientos</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colReq]}>
                  Requerimiento
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colStatus]}>
                  Estado
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colCreator]}>
                  Creador
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colCost]}>
                  Costo
                </Text>
              </View>
              {requirements.map((req, index) => (
                <View key={index} style={styles.tableRow}>
                  <View style={styles.colReq}>
                    <Text style={styles.tableCell}>{req.titulo}</Text>
                  </View>
                  <View style={styles.colStatus}>
                    <Text
                      style={[
                        styles.tableCell,
                        req.completado ? styles.statusCompleted : styles.statusPending,
                      ]}
                    >
                      {req.completado ? "Completado" : "Pendiente"}
                    </Text>
                  </View>
                  <View style={styles.colCreator}>
                    <Text style={styles.tableCell}>
                      {req.creador?.nombre || "-"}
                    </Text>
                  </View>
                  <View style={styles.colCost}>
                    <Text style={styles.tableCell}>
                      {req.costo ? formatCurrency(req.costo) : "-"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Team */}
        {team.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Equipo de Trabajo</Text>
            {team.map((member, index) => (
              <View key={index} style={styles.teamMember}>
                <View>
                  <Text style={styles.memberName}>{member.nombre}</Text>
                  {member.puesto && (
                    <Text style={styles.memberRole}>{member.puesto}</Text>
                  )}
                </View>
                {member.monto_acordado && (
                  <Text style={styles.memberAmount}>
                    {formatCurrency(member.monto_acordado)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Total Cost */}
        {totalCost > 0 && (
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Costo Total de Requerimientos</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalCost)}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generado el {formatDate(new Date().toISOString())} | Corazones
            Cruzados
          </Text>
        </View>
      </Page>
    </Document>
  );
}
