import json
import random
import uuid
from datetime import datetime

# --- CONFIGURATION & DISTRIBUTION ---

HIERARCHY_DISTRIBUTION = {
    "Estagiário": 20,
    "Trainee": 15,
    "Júnior": 40,
    "Pleno": 50,
    "Sênior": 45,
    "Especialista/Staff": 30,
    "Tech Lead": 25,
    "Coordenador": 20,
    "Gerente": 20,
    "Gerente Sênior": 15,
    "Diretor": 10,
    "C-Level": 10
}

AREAS = [
    "Desenvolvimento (Frontend)", "Desenvolvimento (Backend)", "Desenvolvimento (Full Stack)", "Desenvolvimento (Mobile)",
    "DevOps/SRE", "Data Engineering", "Data Science", "Security/InfoSec", "QA/Testing", "UX/UI Design",
    "Product Management", "Project Management", "Architecture", "Support/Customer Success"
]

# --- DATA BANKS ---

FIRST_NAMES = [
    "Ana", "Bruno", "Carlos", "Daniela", "Eduardo", "Fernanda", "Gabriel", "Helena", "Igor", "Julia",
    "Kai", "Lucas", "Mariana", "Nicolas", "Olivia", "Pedro", "Quentin", "Rafaela", "Samuel", "Tatiana",
    "Ulysses", "Vanessa", "Wagner", "Xavier", "Yasmin", "Zoe", "Ali", "Fatima", "Hiroshi", "Yuki",
    "Chen", "Wei", "Priya", "Rahul", "Kwame", "Amara", "Diego", "Sofia", "Mateo", "Valentina",
    "Alex", "Jordan", "Casey", "Taylor", "Morgan", "Riley", "Avery", "Quinn", "Skyler", "Dakota"
]

LAST_NAMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
    "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa",
    "Tanaka", "Suzuki", "Kim", "Lee", "Singh", "Patel", "Muller", "Schmidt", "Dubois", "Leroy",
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Martinez", "Hernandez", "Lopez", "Gonzalez"
]

UNIVERSITIES = [
    "USP", "UNICAMP", "UFRJ", "UFMG", "PUC-SP", "PUC-RS", "FGV", "Mackenzie", "FIAP", "FATEC",
    "MIT", "Stanford", "Harvard", "Oxford", "Cambridge", "Tsinghua", "University of Tokyo",
    "Autodidata", "Bootcamp Ironhack", "Bootcamp Le Wagon", "Bootcamp Rocketseat", "Udemy/Coursera"
]

LOCATIONS = [
    "São Paulo, SP (Híbrido)", "São Paulo, SP (Presencial)", "Rio de Janeiro, RJ (Remoto)", "Belo Horizonte, MG (Remoto)",
    "Curitiba, PR (Híbrido)", "Florianópolis, SC (Remoto)", "Recife, PE (Remoto)", "Porto Alegre, RS (Híbrido)",
    "Brasília, DF (Presencial)", "Remoto (Nomade Digital)", "Campinas, SP (Híbrido)", "São José dos Campos, SP (Presencial)"
]

PSYCH_DIMENSIONS = {
    "Estilo de Comunicação": [
        "Direto e assertivo", "Diplomático e cauteloso", "Verboso e detalhista", "Conciso e objetivo",
        "Formal e estruturado", "Casual e flexível", "Proativo", "Reservado"
    ],
    "Abordagem ao Trabalho": [
        "Metódico e planejador", "Improvisador e adaptável", "Foco em qualidade", "Foco em velocidade",
        "Inovador/experimental", "Conservador/tradicional", "Generalista", "Especialista", "Independente", "Colaborativo"
    ],
    "Gestão de Conflitos": [
        "Confrontador direto", "Evitador de conflitos", "Mediador natural", "Tomador de lados",
        "Focado em soluções", "Focado em causas", "Emocional", "Racional"
    ],
    "Relação com Tecnologia": [
        "Early adopter", "Cético com novidades", "Pragmático", "Idealista tecnológico",
        "Code-first", "Architecture-first", "Open source enthusiast", "Enterprise-focused"
    ],
    "Liderança e Influência": [
        "Líder nato", "Contribuidor individual", "Mentor ativo", "Focado na entrega",
        "Político/networker", "Técnico puro", "Visionário", "Executor"
    ],
    "Relação com Processos": [
        "Seguidor rigoroso", "Questionador constante", "Criador de processos", "Anarquista metodológico",
        "Documentador compulsivo", "Código auto-explicativo", "Ágil purista", "Pragmático híbrido"
    ],
    "Gestão de Estresse": [
        "Resiliente sob pressão", "Necessita ambiente estável", "Thrives no caos", "Precisa de previsibilidade",
        "Workaholic", "Work-life balance advocator"
    ],
    "Motivadores Principais": [
        "Crescimento técnico", "Crescimento de carreira", "Impacto no produto", "Reconhecimento pessoal",
        "Estabilidade", "Desafios constantes", "Autonomia", "Direcionamento claro", "Propósito", "Dinheiro"
    ]
}

SKILLS_BY_AREA = {
    "Desenvolvimento": ["Java", "Python", "JavaScript", "TypeScript", "React", "Node.js", "C#", ".NET", "Go", "Rust", "Docker", "Kubernetes", "AWS", "Azure"],
    "Data": ["Python", "SQL", "Spark", "Hadoop", "Pandas", "TensorFlow", "PyTorch", "Tableau", "PowerBI", "Airflow", "Snowflake"],
    "DevOps": ["Terraform", "Ansible", "Jenkins", "GitLab CI", "Prometheus", "Grafana", "Linux", "Bash", "Python", "Go"],
    "Product": ["Jira", "Confluence", "Figma", "Miro", "Google Analytics", "Amplitude", "SQL", "Roadmapping", "User Research"],
    "Design": ["Figma", "Adobe XD", "Sketch", "Photoshop", "Illustrator", "Prototyping", "User Testing", "HTML/CSS"],
    "Management": ["Scrum", "Kanban", "SAFe", "OKRs", "People Management", "Strategic Planning", "Budgeting", "Hiring"],
    "Security": ["OWASP", "Pen Testing", "Network Security", "Cryptography", "Compliance", "ISO 27001", "Python", "Bash"]
}

FRAMEWORKS = ["Scrum", "Kanban", "SAFe", "LeSS", "XP", "Waterfall (Legacy)", "Shape Up"]

# --- GENERATOR LOGIC ---


NON_TECH_AREAS = [
    "Recursos Humanos (Recrutamento)", "Recursos Humanos (Business Partner)", "Recursos Humanos (Treinamento)",
    "Financeiro (Contas a Pagar)", "Financeiro (Planejamento)", "Financeiro (Controladoria)",
    "Marketing (Redes Sociais)", "Marketing (Branding)", "Marketing (Performance)",
    "Vendas (SDR)", "Vendas (Executivo de Contas)", "Vendas (Customer Success)",
    "Operações (Facilities)", "Operações (Administrativo)", "Jurídico (Contratos)", "Jurídico (Compliance)"
]

NON_TECH_SKILLS = {
    "Recursos Humanos": ["Gestão de Pessoas", "Recrutamento e Seleção", "Legislação Trabalhista", "Treinamento", "Cultura Organizacional", "Negociação", "LinkedIn Recruiter"],
    "Financeiro": ["Excel Avançado", "Modelagem Financeira", "Contabilidade", "Auditoria", "SAP", "Gestão de Orçamento", "Matemática Financeira"],
    "Marketing": ["SEO", "Google Analytics", "Copywriting", "Gestão de Redes Sociais", "Branding", "Adobe Creative Suite", "CRM"],
    "Vendas": ["Negociação", "CRM (Salesforce/HubSpot)", "Prospecção", "Venda Consultiva", "Oratória", "Gestão de Pipeline"],
    "Operações": ["Gestão de Projetos", "Excel", "Organização", "Logística", "Gestão de Fornecedores", "Processos Administrativos"],
    "Jurídico": ["Direito Contratual", "Compliance", "LGPD", "Propriedade Intelectual", "Negociação", "Redação Jurídica"]
}

# --- GENERATOR LOGIC ---

def get_age_and_exp(role):
    if role == "Estagiário": return random.randint(18, 25), 0, 0
    if role == "Trainee": return random.randint(22, 28), random.randint(0, 1), random.randint(0, 2)
    if role == "Júnior": return random.randint(20, 30), random.randint(0, 2), random.randint(0, 3)
    if role == "Pleno": return random.randint(24, 35), random.randint(2, 5), random.randint(2, 6)
    if role == "Sênior": return random.randint(28, 45), random.randint(5, 10), random.randint(5, 12)
    if role == "Especialista/Staff": return random.randint(30, 50), random.randint(8, 15), random.randint(8, 18)
    if role == "Tech Lead": return random.randint(28, 45), random.randint(5, 10), random.randint(6, 15)
    if role == "Coordenador": return random.randint(30, 45), random.randint(2, 8), random.randint(5, 12)
    if role == "Gerente": return random.randint(32, 50), random.randint(4, 10), random.randint(8, 15)
    if role == "Gerente Sênior": return random.randint(35, 55), random.randint(5, 12), random.randint(10, 20)
    if role == "Diretor": return random.randint(40, 60), random.randint(5, 15), random.randint(15, 25)
    if role == "C-Level": return random.randint(40, 65), random.randint(5, 20), random.randint(15, 30)
    return 30, 5, 5


    
    return profile

def generate_ace_params(profile):
    """
    Generates ACE (Attributes, Context, Execution) parameters for RAG optimization.
    Focuses on token economy and reasoning efficiency.
    """
    info = profile["informacoes_basicas"]
    psych = profile["psicologia_comportamento"]
    skills = profile["habilidades"]
    context = profile["contexto"]
    
    # A - Attributes (Who they are, condensed)
    # Format: Role | Area | Level | Top Skills
    attributes = f"{info['cargo']} | {info['area']} | {info['tempo_empresa']} exp | {', '.join(skills['hard_skills'][:3])}"
    
    # C - Context (What they are facing)
    # Format: Challenge | Motivation | Framework
    ctx = f"Desafio: {context['desafio_atual']} | Motivação: {context['motivacao_atual']} | Framework: {context['framework_preferido']}"
    
    # E - Execution (How they behave)
    # Format: Comm Style | Work Approach | Conflict | Decision
    execution = f"{psych['Estilo de Comunicação']} | {psych['Abordagem ao Trabalho']} | {psych['Gestão de Conflitos']} | {psych['Liderança e Influência']}"
    
    # High-density summary for embedding
    summary = f"[{info['cargo']}] {info['nome']} ({info['area']}). {psych['Estilo de Comunicação']}, {psych['Abordagem ao Trabalho']}. Foca em {', '.join(skills['hard_skills'][:2])}."
    
    return {
        "A": attributes,
        "C": ctx,
        "E": execution,
        "resumo_compacto": summary,
        "tags_busca": [info['cargo'], info['area'], psych['Estilo de Comunicação'], psych['Abordagem ao Trabalho']]
    }

def generate_profile(role, is_tech=True):
    age, tenure_company, tenure_career = get_age_and_exp(role)
    
    # Basic Info
    first_name = random.choice(FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)
    full_name = f"{first_name} {last_name}"
    
    if is_tech:
        area = random.choice(AREAS)
    else:
        area = random.choice(NON_TECH_AREAS)

    # Adjust area for C-Level/Directors slightly
    if role in ["C-Level", "Diretor"]:
        if is_tech:
            area = f"Gestão Estratégica de {area.split(' ')[0]}"
        else:
            area = f"Diretoria de {area.split(' ')[0]}"

    # Diversity Factors
    gender = random.choice(["Masculino", "Feminino", "Não-binário"])
    neurodivergence = random.choice([None, None, None, "TDAH", "Autismo (Nível 1)", "Dislexia"]) if random.random() < 0.15 else None
    
    # Psych Profile
    psych = {k: random.choice(v) for k, v in PSYCH_DIMENSIONS.items()}
    
    # Skills
    if is_tech:
        base_skills = SKILLS_BY_AREA.get(area.split(' ')[0], SKILLS_BY_AREA["Desenvolvimento"])
        if "Gestão" in area or role in ["Gerente", "Coordenador", "Diretor", "C-Level"]:
            base_skills += SKILLS_BY_AREA["Management"]
    else:
        # Find matching key in NON_TECH_SKILLS based on area string
        base_skills = []
        for key, skills in NON_TECH_SKILLS.items():
            if key in area:
                base_skills = skills
                break
        if not base_skills:
            base_skills = ["Comunicação", "Organização", "Office"] # Fallback

    hard_skills = random.sample(base_skills, k=min(len(base_skills), random.randint(3, 6)))
    
    # Context
    if is_tech:
        framework_exp = random.choice(FRAMEWORKS)
        opiniao_agil = random.choice(["Entusiasta", "Cético", "Indiferente", "Pragmático"])
        desafio = "Entregar o projeto X dentro do prazo apertado" if random.random() > 0.5 else "Reestruturar o time após layoffs"
    else:
        framework_exp = "N/A" if random.random() > 0.3 else random.choice(["Kanban (Básico)", "Scrum (Ouvinte)", "Nenhum"])
        opiniao_agil = random.choice(["Curioso", "Confuso", "Indiferente", "Acha burocrático"])
        desafio = random.choice([
            "Bater a meta do trimestre",
            "Organizar a festa de fim de ano",
            "Contratar 10 pessoas em 1 mês",
            "Reduzir custos operacionais",
            "Lidar com reclamações de clientes",
            "Implementar novo sistema de ERP"
        ])

    profile = {
        "id": str(uuid.uuid4()),
        "tipo": "Tech" if is_tech else "Non-Tech",
        "informacoes_basicas": {
            "nome": full_name,
            "genero": gender,
            "idade": age,
            "cargo": role,
            "area": area,
            "tempo_empresa": f"{tenure_company} anos",
            "tempo_carreira": f"{tenure_career} anos",
            "formacao": random.choice(UNIVERSITIES),
            "localizacao": random.choice(LOCATIONS),
            "neurodivergencia": neurodivergence
        },
        "psicologia_comportamento": psych,
        "habilidades": {
            "hard_skills": hard_skills,
            "soft_skills": ["Comunicação", "Liderança", "Resolução de Problemas", "Empatia", "Negociação"] # Simplified
        },
        "contexto": {
            "framework_preferido": framework_exp,
            "opiniao_agil": opiniao_agil,
            "desafio_atual": desafio,
            "motivacao_atual": psych["Motivadores Principais"]
        },
        "historia": f"{first_name} começou na área {'de tecnologia' if is_tech else 'corporativa'} por {random.choice(['curiosidade', 'necessidade', 'indicação', 'influência familiar'])}. Já passou por {random.randint(1, 5)} empresas."
    }
    
    # Add ACE Parameters
    profile["ace_metadata"] = generate_ace_params(profile)
    
    return profile


def main():
    all_profiles = []
    
    print("Gerando perfis Tech...")
    for role, count in HIERARCHY_DISTRIBUTION.items():
        # print(f"Gerando {count} perfis para {role}...")
        for _ in range(count):
            all_profiles.append(generate_profile(role, is_tech=True))

    print("Gerando perfis Non-Tech...")
    # Generate ~50 non-tech profiles distributed roughly
    non_tech_roles = ["Estagiário", "Júnior", "Pleno", "Sênior", "Coordenador", "Gerente", "Diretor"]
    for i in range(50):
        role = random.choice(non_tech_roles)
        all_profiles.append(generate_profile(role, is_tech=False))
            
    # Shuffle to mix roles in the list if needed, but grouping by role is also fine.
    # random.shuffle(all_profiles)
    
    output_file = "c:/Users/adm/Desktop/Prototipos/RAG/profiles.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_profiles, f, ensure_ascii=False, indent=2)
        
    print(f"Concluído! {len(all_profiles)} perfis gerados em {output_file}")


if __name__ == "__main__":
    main()
