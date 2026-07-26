import type { TableInfo } from '@/lib/admin/fuentes';

/**
 * TAXONOMÍA de las tablas de `gcc_world` para el explorador "Fuentes": agrupa las 171
 * tablas en un árbol de carpetas **módulo → sistema → subsistema**, como se navega la
 * app, en vez de una lista alfabética plana.
 *
 * De dónde sale: de dónde se CREA y se usa cada tabla en el código
 * (`lib/<módulo>/…`, `lib/centralized/<sistema>-db.ts`, `app/api/…`). Los nombres de los
 * sistemas de Centralizado son los mismos que ve el usuario en el módulo (tabla
 * `centralized_systems`).
 *
 * MANTENIMIENTO: una tabla que no aparezca aquí NO se pierde — el árbol la coloca sola
 * en la carpeta "Sin clasificar". Al crear una tabla nueva, añádela al grupo que le
 * toque para que quede ordenada.
 */

export type NodeKind = 'module' | 'system' | 'subsystem' | 'group';

export interface TreeSpec {
  name: string;
  kind: NodeKind;
  /** Aclaración corta (se muestra como tooltip). */
  hint?: string;
  /** Tablas que cuelgan directamente de esta carpeta. */
  tables?: string[];
  children?: TreeSpec[];
}

export const FUENTES_TAXONOMY: TreeSpec[] = [
  {
    name: 'Usuarios y acceso', kind: 'module', hint: 'Cuentas, sesiones y llaves de acceso',
    tables: ['users', 'verification_tokens', 'client_passkeys', 'user_api_keys'],
  },
  {
    name: 'Equipo', kind: 'module', hint: 'Miembros de la organización',
    tables: ['members', 'positions', 'applicants'],
    children: [
      { name: 'Perfil del miembro', kind: 'subsystem',
        tables: ['member_cv_profiles', 'member_portfolio_items', 'member_services'] },
      { name: 'Disponibilidad', kind: 'subsystem',
        tables: ['member_schedules', 'schedule_exceptions'] },
    ],
  },
  {
    name: 'Clientes', kind: 'module',
    tables: ['clients', 'billing_clients', 'client_members'],
  },
  {
    name: 'Tickets', kind: 'module',
    tables: ['tickets', 'ticket_actions', 'ticket_time_slots', 'ticket_services', 'services'],
  },
  {
    name: 'Proyectos', kind: 'module',
    tables: ['projects', 'project_members', 'project_bids', 'project_payments', 'project_requests',
             'project_cancellation_requests', 'project_cancellation_votes', 'invoice_projects'],
    children: [
      { name: 'Requerimientos', kind: 'subsystem',
        tables: ['project_requirements', 'requirement_items', 'requirement_assignments'] },
      { name: 'Cotizaciones', kind: 'subsystem', hint: 'Proyectos en estado cotización',
        tables: ['quote_sessions', 'quote_versions', 'project_observations'] },
      { name: 'Incidentes', kind: 'subsystem',
        tables: ['project_incidents', 'project_incident_categories', 'project_incident_subcategories'] },
    ],
  },
  {
    name: 'Facturas y finanzas', kind: 'module',
    tables: ['invoices', 'invoice_items', 'invoice_items_sri',
             'finance_items', 'finance_months', 'finance_source_log'],
  },
  {
    name: 'Suscripciones', kind: 'module',
    tables: ['subscriptions', 'subscription_payments'],
  },
  {
    name: 'Marketplace', kind: 'module',
    tables: ['products', 'orders', 'order_items', 'cart_items'],
    children: [
      { name: 'Paquetes', kind: 'subsystem',
        tables: ['packages', 'package_assignments', 'package_progress_updates',
                 'package_purchases', 'package_requests'] },
    ],
  },
  {
    name: 'Automatizaciones', kind: 'module', hint: 'Flujos de email, WhatsApp y chatbot',
    tables: ['flows'],
    children: [
      { name: 'Campañas y contactos', kind: 'subsystem',
        tables: ['flow_campaigns', 'flow_campaign_sends', 'flow_contacts', 'flow_contact_lists'] },
      { name: 'WhatsApp', kind: 'subsystem',
        tables: ['flow_wa_templates', 'whatsapp_campaigns', 'whatsapp_sends'] },
      { name: 'Correo', kind: 'subsystem',
        tables: ['email_campaigns', 'email_contacts', 'email_lists', 'email_sends'] },
    ],
  },
  {
    name: 'Centralizado', kind: 'module', hint: 'Modelo 4P: sus sistemas y subsistemas',
    tables: ['centralized_systems', 'centralized_member_access'],
    children: [
      {
        name: 'Gestión de Datos', kind: 'system', hint: 'Piso Pilar · Fundamentación',
        children: [
          { name: 'Temas y materias', kind: 'subsystem',
            tables: ['gd_temas', 'gd_materias', 'gd_tema_materias', 'gd_subtemas',
                     'gd_tema_subtemas', 'gd_subtema_hipotesis'] },
          { name: 'Problemas y situaciones', kind: 'subsystem',
            tables: ['gd_problemas', 'gd_problematicas', 'gd_tema_problemas',
                     'gd_situaciones', 'gd_enfrentamientos'] },
          { name: 'Rompecabezas y piezas', kind: 'subsystem',
            tables: ['gd_rompecabezas', 'gd_rompecabezas_piezas', 'gd_subtema_rompecabezas',
                     'gd_piezas', 'gd_pieza_codigos', 'gd_pieza_variables'] },
          { name: 'Códigos y categorías', kind: 'subsystem',
            tables: ['gd_codigos', 'gd_codigo_eventos', 'gd_codigo_unidades',
                     'gd_categorias', 'gd_categoria_codigos'] },
          { name: 'Fuentes y referencias', kind: 'subsystem',
            tables: ['gd_fuentes', 'gd_fuente_pesos', 'gd_referencias'] },
        ],
      },
      { name: 'Encuadre Condiciológico', kind: 'system', hint: 'Piso Global · Fundamentación · listas globales',
        tables: ['gd_talentos', 'gd_valores'] },
      { name: 'Gestión de Condiciones', kind: 'system', hint: 'Piso Controlador · Fundamentación',
        tables: ['gc_condiciones', 'gc_condicion_eventos', 'gc_condicion_restricciones',
                 'gc_condicion_variables', 'gc_requerimientos', 'gc_requerimiento_projects',
                 'gc_requerimiento_tickets'] },
      { name: 'Dinámica Condiciológica', kind: 'system', hint: 'Piso Global · Fundamentación',
        tables: ['dc_variables'] },
      { name: 'Metodología Condiciológica', kind: 'system', hint: 'Piso Global · Fundamentación',
        tables: ['mc_research_projects', 'mc_tasks', 'mc_task_codigos', 'mc_task_pieza'] },
      { name: 'Apoyo y Autoayuda', kind: 'system', hint: 'Piso Global · Implementación',
        tables: ['aa_situations', 'aa_situation_problems', 'aa_problems', 'aa_problem_causes',
                 'aa_causes', 'aa_solutions', 'aa_solution_causes', 'aa_solution_problems',
                 'aa_alternative_projects', 'aa_alternative_tickets'] },
      { name: 'Horario de Vida', kind: 'system', hint: 'Piso Controlador · Implementación',
        tables: ['hv_schedule', 'hv_task_labels'] },
      { name: 'Gestión Social', kind: 'system', hint: 'Piso Controlador · Gestión · eventos',
        tables: ['gs_events', 'gs_event_tasks', 'gs_task_signups', 'gs_valoraciones'] },
      { name: 'Percepción Social', kind: 'system', hint: 'Piso Colaborador · Gestión',
        tables: ['ps_capturas', 'ps_elementos', 'ps_fotos'] },
      { name: 'Comandos Violeta', kind: 'system', hint: 'Piso Global · Creación · políticas',
        tables: ['cv_policies', 'cv_categories', 'cv_functions', 'cv_generated_tasks'] },
      { name: 'Reclutamiento y Selección', kind: 'system', hint: 'Piso Global · Implementación',
        tables: ['candidate_proposals'] },
    ],
  },
  {
    name: 'Pensamientos', kind: 'module', hint: 'Cuaderno personal con clasificación por IA',
    tables: ['pn_thoughts', 'pn_tagging_runs'],
  },
  {
    name: 'Experiencias', kind: 'module', hint: 'Eventos abiertos a candidatos y miembros',
    tables: ['event_invitations', 'event_scores', 'recruitment_events'],
  },
  {
    name: 'Mi día y calendario', kind: 'module',
    tables: ['member_calendar_events', 'member_calendar_subscribers'],
  },
  {
    name: 'Recordatorios', kind: 'module',
    tables: ['reminders', 'reminder_attachments', 'meet_orphan_records'],
  },
  {
    name: 'Notificaciones', kind: 'module',
    tables: ['notifications'],
  },
  {
    name: 'Chat', kind: 'module',
    tables: ['ch_conversations', 'ch_messages', 'ch_presence', 'ch_reads'],
  },
  {
    name: 'Soporte', kind: 'module',
    tables: ['support_tickets', 'support_replies'],
  },
  {
    name: 'Admin', kind: 'module', hint: 'Utilidades del administrador',
    tables: ['razones', 'tutoriales'],
  },
  {
    name: 'Videojuego (DigiMundo)', kind: 'module',
    tables: ['scenes', 'world_maps', 'npcs', 'lights', 'item_placements', 'item_placement_syncs'],
    children: [
      { name: 'Economía y progreso', kind: 'subsystem',
        tables: ['game_currencies', 'game_stages', 'game_action_log', 'ledger_entries',
                 'ledger_balances', 'player_progress', 'player_flags', 'player_stage_unlocks'] },
      { name: 'Estructura de proyectos', kind: 'subsystem', hint: 'Modelos Prisma del agente DigiMundo',
        tables: ['Project', 'Module', 'Section', 'Subsection', 'Incident'] },
    ],
  },
  {
    name: 'Sistema y mantenimiento', kind: 'module', hint: 'Infraestructura y tablas heredadas',
    tables: ['schema_migrations', 'modules', 'faq'],
  },
];

/** Nodo del árbol ya resuelto contra las tablas que existen de verdad. */
export interface TreeNode {
  /** Ruta única (`Centralizado/Gestión de Datos/…`), sirve de clave de expansión. */
  id: string;
  name: string;
  kind: NodeKind;
  hint?: string;
  tables: TableInfo[];
  children: TreeNode[];
  /** Totales acumulados (incluyen descendientes). */
  tableCount: number;
  rowCount: number;
}

/**
 * Arma el árbol con las tablas REALES: descarta de la taxonomía lo que no exista, poda
 * las carpetas que quedan vacías y agrupa en "Sin clasificar" lo que no esté mapeado.
 */
export function buildFuentesTree(tables: TableInfo[]): TreeNode[] {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const used = new Set<string>();

  const walk = (spec: TreeSpec, parentId: string): TreeNode | null => {
    const id = parentId ? `${parentId}/${spec.name}` : spec.name;

    const own: TableInfo[] = [];
    for (const name of spec.tables ?? []) {
      const t = byName.get(name);
      if (!t || used.has(name)) continue;   // no existe, o ya la tomó otra carpeta
      used.add(name);
      own.push(t);
    }

    const children = (spec.children ?? [])
      .map((c) => walk(c, id))
      .filter((c): c is TreeNode => c !== null);

    if (!own.length && !children.length) return null;   // carpeta vacía: no se muestra

    return {
      id,
      name: spec.name,
      kind: spec.kind,
      hint: spec.hint,
      tables: own,
      children,
      tableCount: own.length + children.reduce((n, c) => n + c.tableCount, 0),
      rowCount: own.reduce((n, t) => n + t.rows, 0) + children.reduce((n, c) => n + c.rowCount, 0),
    };
  };

  const tree = FUENTES_TAXONOMY
    .map((spec) => walk(spec, ''))
    .filter((n): n is TreeNode => n !== null);

  // Lo que no cayó en ninguna carpeta (tablas nuevas o no mapeadas todavía).
  const rest = tables.filter((t) => !used.has(t.name));
  if (rest.length) {
    tree.push({
      id: 'Sin clasificar',
      name: 'Sin clasificar',
      kind: 'group',
      hint: 'Tablas que todavía no están en la taxonomía de lib/admin/fuentes-tree.ts',
      tables: rest,
      children: [],
      tableCount: rest.length,
      rowCount: rest.reduce((n, t) => n + t.rows, 0),
    });
  }

  return tree;
}

/** Filtra el árbol por texto (nombre de tabla o de carpeta). Devuelve solo lo que casa. */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const prune = (node: TreeNode): TreeNode | null => {
    // Si la carpeta casa, se conserva entera (con todo su contenido).
    if (node.name.toLowerCase().includes(q)) return node;

    const tables = node.tables.filter((t) => t.name.toLowerCase().includes(q));
    const children = node.children.map(prune).filter((c): c is TreeNode => c !== null);
    if (!tables.length && !children.length) return null;

    return {
      ...node,
      tables,
      children,
      tableCount: tables.length + children.reduce((n, c) => n + c.tableCount, 0),
      rowCount: tables.reduce((n, t) => n + t.rows, 0) + children.reduce((n, c) => n + c.rowCount, 0),
    };
  };

  return nodes.map(prune).filter((n): n is TreeNode => n !== null);
}

/** Ids de todas las carpetas (para "expandir todo" / expandir en una búsqueda). */
export function allNodeIds(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => [n.id, ...allNodeIds(n.children)]);
}
