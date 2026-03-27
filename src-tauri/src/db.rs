use serde::{Deserialize, Serialize};
use surrealdb::Surreal;
use surrealdb::engine::local::Mem;
use surrealdb::types::RecordId;
use surrealdb::types::SurrealValue;

pub type AppDb = Surreal<surrealdb::engine::local::Db>;

#[derive(Debug, Serialize, Deserialize, SurrealValue)]
pub struct Material {
    pub id: Option<RecordId>,
    pub name: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, SurrealValue)]
pub struct Course {
    pub id: Option<RecordId>,
    pub name: String,
    pub material_id: String,
}

#[derive(Debug, Serialize, Deserialize, SurrealValue)]
pub struct ConceptNode {
    pub id: Option<RecordId>,
    pub course_id: String,
    pub title: String,
    pub content: String,
    pub status: String,
    pub order_index: i32,
}

pub async fn init_db() -> surrealdb::Result<AppDb> {
    let db = Surreal::new::<Mem>(()).await?;
    db.use_ns("learning").use_db("main").await?;
    println!("SurrealDB zainicjowane z modelami kursów i węzłów.");
    Ok(db)
}

pub async fn save_material(db: &AppDb, name: &str, content: &str) -> surrealdb::Result<Option<Material>> {
    let created: Option<Material> = db
        .create("material")
        .content(serde_json::json!({
            "name": name,
            "content": content
        }))
        .await?;
    Ok(created)
}

pub async fn list_materials(db: &AppDb) -> surrealdb::Result<Vec<Material>> {
    let materials: Vec<Material> = db.select("material").await?;
    Ok(materials)
}

pub async fn create_course(db: &AppDb, name: &str, material_id: &str) -> surrealdb::Result<Option<Course>> {
    let created: Option<Course> = db
        .create("course")
        .content(serde_json::json!({
            "name": name,
            "material_id": material_id
        }))
        .await?;
    Ok(created)
}

pub async fn list_courses(db: &AppDb) -> surrealdb::Result<Vec<Course>> {
    let courses: Vec<Course> = db.select("course").await?;
    Ok(courses)
}

pub async fn save_concept(db: &AppDb, course_id: &str, title: &str, content: &str, order_index: i32) -> surrealdb::Result<Option<ConceptNode>> {
    let status = if order_index == 0 { "current" } else { "locked" };
    let created: Option<ConceptNode> = db
        .create("concept_node")
        .content(serde_json::json!({
            "course_id": course_id,
            "title": title,
            "content": content,
            "status": status,
            "order_index": order_index
        }))
        .await?;
    Ok(created)
}

pub async fn get_course_roadmap(db: &AppDb, course_id: &str) -> surrealdb::Result<Vec<ConceptNode>> {
    let course_id_owned = course_id.to_string();
    let mut result = db.query("SELECT * FROM concept_node WHERE course_id = $course_id ORDER BY order_index ASC")
        .bind(("course_id", course_id_owned))
        .await?;
    let nodes: Vec<ConceptNode> = result.take(0)?;
    Ok(nodes)
}
