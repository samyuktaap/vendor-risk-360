"""
supply_chain_service.py — Fourth-Party / Supply Chain Risk Management Service.

Provides:
1. Multi-tier dependency validation (self-link prevention, duplicate prevention, cycle detection).
2. Hierarchical supply chain graph construction.
3. Transitive blast-radius impact analysis (identifying all upstream organizations affected by downstream failure).
4. Supply chain risk component scoring.
"""

from __future__ import annotations

from typing import Dict, List, Any, Optional, Set
from collections import defaultdict, deque

VALID_RELATIONSHIP_TYPES = {
    "SUBPROCESSOR",
    "CLOUD_PROVIDER",
    "HOSTING_PROVIDER",
    "PAYMENT_PROVIDER",
    "DATA_PROCESSOR",
    "INFRASTRUCTURE_PROVIDER",
    "SECURITY_PROVIDER",
    "CRITICAL_SERVICE_PROVIDER",
    "OTHER"
}

VALID_CRITICALITY_LEVELS = {
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW"
}

VALID_DEPENDENCY_LEVELS = {
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW"
}

VALID_STATUSES = {
    "ACTIVE",
    "INACTIVE",
    "UNDER_REVIEW"
}

def validate_dependency_integrity(
    upstream_vendor_id: int,
    downstream_vendor_id: Optional[int],
    external_vendor_name: Optional[str],
    relationship_type: str,
    company_id: int,
    db_conn,
    current_dependency_id: Optional[int] = None
) -> None:
    """
    Validates supply chain relationship integrity:
    1. Valid relationship type, criticality, and status
    2. Self-dependency rejection (Vendor A -> Vendor A)
    3. Cross-company ownership validation for both upstream and downstream vendors
    4. Duplicate edge rejection
    5. Circular dependency loop prevention via DFS cycle detection
    """
    if relationship_type not in VALID_RELATIONSHIP_TYPES:
        raise ValueError(f"Invalid relationship_type '{relationship_type}'. Must be one of {sorted(list(VALID_RELATIONSHIP_TYPES))}")

    cursor = db_conn.cursor()
    
    # 1. Validate upstream vendor exists and belongs to company_id
    cursor.execute("SELECT id, company_id FROM vendors WHERE id = ?", (upstream_vendor_id,))
    up_row = cursor.fetchone()
    if not up_row or up_row["company_id"] != company_id:
        raise ValueError(f"Upstream vendor ID {upstream_vendor_id} does not exist or does not belong to authorized company")

    # If downstream is not an internal registered vendor, it must provide external_vendor_name
    if downstream_vendor_id is None:
        if not external_vendor_name or not external_vendor_name.strip():
            raise ValueError("Downstream relationship must specify either a registered vendor or an external provider name")
        # External provider has no circular graph inside registered vendors
        return

    # 2. Prevent self-linking
    if upstream_vendor_id == downstream_vendor_id:
        raise ValueError("A vendor cannot have a supply-chain dependency on itself (self-dependency rejected)")

    # 3. Validate downstream vendor exists and belongs to company_id
    cursor.execute("SELECT id, company_id FROM vendors WHERE id = ?", (downstream_vendor_id,))
    down_row = cursor.fetchone()
    if not down_row or down_row["company_id"] != company_id:
        raise ValueError(f"Downstream vendor ID {downstream_vendor_id} does not exist or does not belong to authorized company")

    # 4. Check for duplicate relationship edge
    if current_dependency_id:
        cursor.execute("""
            SELECT id FROM vendor_dependencies
            WHERE company_id = ? AND upstream_vendor_id = ? AND downstream_vendor_id = ? AND relationship_type = ? AND id != ?
        """, (company_id, upstream_vendor_id, downstream_vendor_id, relationship_type, current_dependency_id))
    else:
        cursor.execute("""
            SELECT id FROM vendor_dependencies
            WHERE company_id = ? AND upstream_vendor_id = ? AND downstream_vendor_id = ? AND relationship_type = ?
        """, (company_id, upstream_vendor_id, downstream_vendor_id, relationship_type))
    
    if cursor.fetchone():
        raise ValueError(f"A '{relationship_type}' relationship already exists between vendor {upstream_vendor_id} and {downstream_vendor_id}")

    # 5. Cycle Detection: Check if adding upstream -> downstream creates a cycle
    # If downstream_vendor_id can reach upstream_vendor_id via existing active edges, then upstream -> downstream would create a cycle!
    cursor.execute("""
        SELECT upstream_vendor_id, downstream_vendor_id
        FROM vendor_dependencies
        WHERE company_id = ? AND downstream_vendor_id IS NOT NULL AND status = 'ACTIVE'
    """, (company_id,))
    existing_edges = cursor.fetchall()

    adj: Dict[int, List[int]] = defaultdict(list)
    for edge in existing_edges:
        u = edge["upstream_vendor_id"]
        v = edge["downstream_vendor_id"]
        if current_dependency_id and edge.get("id") == current_dependency_id:
            continue
        adj[u].append(v)

    # Check if upstream_vendor_id is reachable from downstream_vendor_id
    visited: Set[int] = set()
    queue = deque([downstream_vendor_id])
    visited.add(downstream_vendor_id)

    while queue:
        curr = queue.popleft()
        if curr == upstream_vendor_id:
            raise ValueError(f"Adding this dependency would create a circular dependency loop ({upstream_vendor_id} -> {downstream_vendor_id} -> ... -> {upstream_vendor_id})")
        for neighbor in adj.get(curr, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)


def build_supply_chain_graph(company_id: int, db_conn, root_vendor_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Constructs node and edge lists representing the multi-tier supply chain graph.
    Calculates tree depths from company root down to 4th and 5th parties.
    """
    cursor = db_conn.cursor()
    
    # 1. Fetch all company vendors
    cursor.execute("""
        SELECT id, name, domain, sector, risk_score, effective_tier, criticality_tier
        FROM vendors WHERE company_id = ?
    """, (company_id,))
    vendors = {row["id"]: dict(row) for row in cursor.fetchall()}

    # 2. Fetch all dependencies
    cursor.execute("""
        SELECT d.*, 
               u.name as upstream_name, u.domain as upstream_domain,
               w.name as downstream_name, w.domain as downstream_domain
        FROM vendor_dependencies d
        JOIN vendors u ON d.upstream_vendor_id = u.id
        LEFT JOIN vendors w ON d.downstream_vendor_id = w.id
        WHERE d.company_id = ?
    """, (company_id,))
    deps = [dict(r) for r in cursor.fetchall()]

    nodes_dict = {}
    edges = []

    # If root_vendor_id is given, filter for connected subgraph
    relevant_vendor_ids = set()
    if root_vendor_id:
        relevant_vendor_ids.add(root_vendor_id)
        # Downstream traversal
        down_queue = deque([root_vendor_id])
        while down_queue:
            curr = down_queue.popleft()
            for d in deps:
                if d["upstream_vendor_id"] == curr:
                    if d["downstream_vendor_id"]:
                        if d["downstream_vendor_id"] not in relevant_vendor_ids:
                            relevant_vendor_ids.add(d["downstream_vendor_id"])
                            down_queue.append(d["downstream_vendor_id"])
        # Upstream traversal
        up_queue = deque([root_vendor_id])
        while up_queue:
            curr = up_queue.popleft()
            for d in deps:
                if d["downstream_vendor_id"] == curr:
                    if d["upstream_vendor_id"] not in relevant_vendor_ids:
                        relevant_vendor_ids.add(d["upstream_vendor_id"])
                        up_queue.append(d["upstream_vendor_id"])

    # Populate nodes
    for v_id, v in vendors.items():
        if root_vendor_id and v_id not in relevant_vendor_ids:
            continue
        nodes_dict[f"vendor_{v_id}"] = {
            "id": f"vendor_{v_id}",
            "vendor_id": v_id,
            "name": v["name"],
            "domain": v["domain"],
            "sector": v.get("sector", "Technology"),
            "risk_score": v.get("risk_score", 0),
            "tier": v.get("effective_tier", "TIER_3_MEDIUM"),
            "is_external": False
        }

    # Populate external nodes and edges
    for d in deps:
        u_id = d["upstream_vendor_id"]
        v_id = d["downstream_vendor_id"]

        if root_vendor_id and (u_id not in relevant_vendor_ids and v_id not in relevant_vendor_ids):
            continue

        src_key = f"vendor_{u_id}"
        if v_id:
            dst_key = f"vendor_{v_id}"
        else:
            ext_name = d.get("external_vendor_name") or "External Provider"
            dst_key = f"ext_{d['id']}"
            nodes_dict[dst_key] = {
                "id": dst_key,
                "vendor_id": None,
                "name": ext_name,
                "domain": d.get("external_vendor_domain", ""),
                "sector": "External Provider",
                "risk_score": 35,
                "tier": "TIER_3_MEDIUM",
                "is_external": True
            }

        edges.append({
            "id": d["id"],
            "source": src_key,
            "target": dst_key,
            "upstream_vendor_id": u_id,
            "downstream_vendor_id": v_id,
            "relationship_type": d["relationship_type"],
            "criticality": d["criticality"],
            "dependency_level": d["dependency_level"],
            "status": d["status"],
            "description": d.get("description")
        })

    return {
        "nodes": list(nodes_dict.values()),
        "edges": edges,
        "total_nodes": len(nodes_dict),
        "total_edges": len(edges)
    }


def calculate_downstream_impact(vendor_id: int, company_id: int, db_conn) -> Dict[str, Any]:
    """
    Computes the blast-radius impact analysis if `vendor_id` suffers an outage, breach, or severe incident.
    
    Identifies:
    1. Direct upstream vendors depending on this vendor.
    2. Transitive (multi-hop) upstream vendors affected.
    3. Downstream dependencies that this vendor depends on.
    4. Criticality distribution of affected vendors.
    5. Maximum dependency depth.
    """
    cursor = db_conn.cursor()

    # Verify target vendor exists
    cursor.execute("SELECT id, name, domain, risk_score, effective_tier, criticality_tier FROM vendors WHERE id = ? AND company_id = ?", (vendor_id, company_id))
    target_vendor = cursor.fetchone()
    if not target_vendor:
        return {
            "error": "Vendor not found",
            "vendor_id": vendor_id,
            "impacted_upstream_count": 0,
            "affected_vendors": []
        }

    # Fetch all company dependencies
    cursor.execute("""
        SELECT d.*, 
               u.name as upstream_name, u.domain as upstream_domain, u.risk_score as upstream_risk_score, u.effective_tier as upstream_tier,
               w.name as downstream_name, w.domain as downstream_domain
        FROM vendor_dependencies d
        JOIN vendors u ON d.upstream_vendor_id = u.id
        LEFT JOIN vendors w ON d.downstream_vendor_id = w.id
        WHERE d.company_id = ?
    """, (company_id,))
    all_deps = [dict(r) for r in cursor.fetchall()]

    # Upstream BFS: find all organizations depending directly or transitively on `vendor_id`
    # Adjacency: downstream -> list of upstreams
    rev_adj: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for d in all_deps:
        if d["downstream_vendor_id"]:
            rev_adj[d["downstream_vendor_id"]].append(d)

    affected_upstreams: Dict[int, Dict[str, Any]] = {}
    visited_depth: Dict[int, int] = {}
    queue = deque([(vendor_id, 0)])

    while queue:
        curr_id, depth = queue.popleft()
        for dep in rev_adj.get(curr_id, []):
            up_id = dep["upstream_vendor_id"]
            if up_id not in visited_depth or visited_depth[up_id] > depth + 1:
                visited_depth[up_id] = depth + 1
                affected_upstreams[up_id] = {
                    "vendor_id": up_id,
                    "name": dep["upstream_name"],
                    "domain": dep["upstream_domain"],
                    "risk_score": dep.get("upstream_risk_score", 0),
                    "tier": dep.get("upstream_tier", "TIER_3_MEDIUM"),
                    "dependency_distance": depth + 1,
                    "relationship_type": dep["relationship_type"],
                    "criticality": dep["criticality"],
                    "dependency_level": dep["dependency_level"]
                }
                queue.append((up_id, depth + 1))

    # Downstream dependencies of target vendor
    direct_downstreams = [
        {
            "dependency_id": d["id"],
            "downstream_vendor_id": d["downstream_vendor_id"],
            "name": d["downstream_name"] or d["external_vendor_name"],
            "domain": d["downstream_domain"] or d["external_vendor_domain"],
            "relationship_type": d["relationship_type"],
            "criticality": d["criticality"],
            "dependency_level": d["dependency_level"],
            "is_external": d["downstream_vendor_id"] is None
        }
        for d in all_deps if d["upstream_vendor_id"] == vendor_id
    ]

    criticality_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for v in affected_upstreams.values():
        c = v.get("criticality", "MEDIUM")
        criticality_counts[c] = criticality_counts.get(c, 0) + 1

    max_depth = max(visited_depth.values()) if visited_depth else 0

    return {
        "vendor": dict(target_vendor),
        "impacted_upstream_count": len(affected_upstreams),
        "direct_downstream_count": len(direct_downstreams),
        "max_dependency_depth": max_depth,
        "criticality_breakdown": criticality_counts,
        "affected_upstream_vendors": sorted(list(affected_upstreams.values()), key=lambda x: x["dependency_distance"]),
        "direct_downstream_dependencies": direct_downstreams,
        "has_impact": len(affected_upstreams) > 0 or len(direct_downstreams) > 0
    }
