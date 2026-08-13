"""Reset agent 13 fiveLayerKnowledge to L1-only baseline state for demo."""
import sqlite3, json

conn = sqlite3.connect("file:app.db?mode=rwc", uri=True)
cur = conn.cursor()

cur.execute("SELECT config FROM agents WHERE id=13")
config = json.loads(cur.fetchone()[0])
flk = config.get("fiveLayerKnowledge", {})

# Preserve L1 knowledge layer; reset L2-L5 to empty
knowledge_layer = flk.get("knowledge_layer", {"topics": [], "subjects": []})
flk_new = {
    "knowledge_layer": knowledge_layer,
    "diagnosis_layer": {"pain_points": []},
    "strategy_layer": {"strategies": []},
    "interaction_layer": {"question_templates": []},
    "feedback_layer": {"feedback_records": []},
}
config["fiveLayerKnowledge"] = flk_new

cur.execute("UPDATE agents SET config = ? WHERE id=13", (json.dumps(config, ensure_ascii=False),))
conn.commit()

# Verify
cur.execute("SELECT config FROM agents WHERE id=13")
config2 = json.loads(cur.fetchone()[0])
flk2 = config2.get("fiveLayerKnowledge", {})
print("L1 topics:", len(flk2.get("knowledge_layer", {}).get("topics", [])))
print("L2 pain_points:", len(flk2.get("diagnosis_layer", {}).get("pain_points", [])))
print("L3 strategies:", len(flk2.get("strategy_layer", {}).get("strategies", [])))
print("L4 question_templates:", len(flk2.get("interaction_layer", {}).get("question_templates", [])))
print("L5 feedback_records:", len(flk2.get("feedback_layer", {}).get("feedback_records", [])))
print("✅ Agent 13 FLK reset: L1 preserved, L2-L5 清空")

conn.close()
