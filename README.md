# Sistema de Alerta e Monitoramento de Incêndios Florestais


## Descrição

Sistema web em tempo real para monitoramento e alerta de incêndios florestais no estado do Maranhão, Brasil. Utiliza dados da NASA FIRMS e integração com API de clima para fornecer informações detalhadas sobre focos de calor e condições meteorológicas.

## Funcionalidades Principais

- Mapa interativo com visualização de focos de calor
- Filtragem por data e município
- Sistema de alertas personalizável
- Dados meteorológicos em tempo real
- Histórico de incêndios por município
- Interface responsiva
- Gráficos de estatísticas
- Notificações em tempo real

## Pré-requisitos

- Node.js v16+
- PostgreSQL 12+
- Navegador moderno (Chrome, Firefox, Safari)
- API Keys:
  - NASA FIRMS
  - OpenWeatherMap
  - Supabase (para notificações)

## Instalação

1. **Clone o repositório**
   ```bash
   git clone <repository-url>
   cd wildfire
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**
   Crie um arquivo `.env` na raiz do projeto:
   ```env
   # Configuração do Banco de Dados
   LOCAL_DB_HOST=localhost
   LOCAL_DB_PORT=5432
   LOCAL_DB_NAME=wildfire
   LOCAL_DB_USER=postgres
   LOCAL_DB_PASSWORD=postgres

   # API NASA FIRMS
   NASA_FIRMS_API_KEY=sua_chave_api_aqui
   NASA_FIRMS_API_BASE_URL=https://firms.modaps.eosdis.nasa.gov/api/

   # OpenWeatherMap API
   OPENWEATHERMAP_API_KEY=sua_chave_api_aqui
   OPENWEATHERMAP_API_BASE_URL=https://api.openweathermap.org/data/2.5

   # Supabase (para notificações)
   SUPABASE_URL=sua_url_aqui
   SUPABASE_ANON_KEY=sua_chave_anon_aqui
   ```

4. **Inicialize o banco de dados**
   ```bash
   psql -U postgres
   CREATE DATABASE wildfire;
   ```

## Inicialização

1. **Inicie o servidor backend**
   ```bash
   npm run dev:backend
   ```
   O servidor rodará na porta 3000.

2. **Inicie o frontend**
   ```bash
   npm run dev
   ```
   O frontend rodará na porta 5173.

3. **Acesse a aplicação**
   Abra seu navegador em `http://localhost:5173`

## Estrutura do Projeto

```
project/
├── src/                    # Código fonte do frontend
│   ├── components/         # Componentes React
│   │   ├── Map.tsx        # Componente do mapa
│   │   └── AlertSettings.tsx  # Configuração de alertas
│   ├── lib/              # Bibliotecas e utilitários
│   ├── types/            # Definições de tipos TypeScript
│   └── types.ts          # Tipos globais
│
├── server/                # Código fonte do backend
│   ├── data/            # Scripts de banco de dados
│   ├── services/        # Serviços e lógica de negócio
│   │   ├── nasaService.js # Integração com NASA
│   │   └── weatherService.js # Integração com API de clima
│   └── index.js         # Configuração do servidor
│
├── supabase/            # Configuração do Supabase
├── public/              # Arquivos estáticos
├── package.json         # Dependências do projeto
└── README.md           # Documentação do projeto
```

## Tecnologias Utilizadas

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React-Leaflet
- Chart.js
- Supabase (para notificações)

### Backend
- Node.js
- Express
- PostgreSQL
- Axios
- CORS
- dotenv

### APIs Externas
- NASA FIRMS API
  - Dados de focos de calor
  - Atualização em tempo real
  - Dados de satélite VIIRS e MODIS

- OpenWeatherMap API
  - Dados meteorológicos atuais
  - Previsão do tempo
  - Alertas meteorológicos

- Supabase
  - Sistema de autenticação
  - Notificações em tempo real
  - Banco de dados

## Recursos Principais

### Mapa Interativo
- Visualização de focos de calor em tempo real
- Zoom e pan
- Filtros por data e localização
- Informações detalhadas sobre cada foco

### Sistema de Alertas
- Alertas personalizáveis por área
- Notificações em tempo real
- Configurações de alerta por email
- Alertas meteorológicos

### Dados Meteorológicos
- Condições atuais do tempo
- Previsão para 5 dias
- Alertas meteorológicos
- Análise de condições favoráveis a incêndios

### Estatísticas e Relatórios
- Gráficos de histórico de incêndios
- Estatísticas por município
- Tendências temporais
- Relatórios de incidência

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Suporte

Para suporte, envie um email para [suporte@wildfire.com.br](mailto:suporte@wildfire.com.br)

## Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
