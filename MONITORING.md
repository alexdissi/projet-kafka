# Système de Monitoring Kafka avec Prometheus et Grafana

Ce projet implémente un système complet de monitoring pour des microservices bancaires basés sur Kafka, utilisant Prometheus pour la collecte de métriques et Grafana pour la visualisation.

## Architecture du Monitoring

### Services Microservices (en JavaScript)
- **Service Commande** (port 3001) - Producteur de transactions bancaires
- **Service Paiement** (port 3004) - Consommateur et processeur de paiements
- **Service Suivi** (port 3002) - Agrégation d'événements
- **Service Analyseur** (port 3003) - Calcul de statistiques

### Stack de Monitoring
- **Prometheus** (port 9090) - Collecte et stockage des métriques
- **Grafana** (port 3000) - Visualisation des métriques
- **JMX Exporter** (port 5556) - Export des métriques Kafka
- **Node Exporter** (port 9100) - Métriques système

## Démarrage Rapide

### Option 1: Démarrage Automatique Complet (Recommandé)

```bash
# Une seule commande pour tout démarrer automatiquement :
npm start

# Cette commande va :
# 1. Démarrer Docker (Kafka + Prometheus + Grafana)
# 2. Attendre que tous les services soient prêts
# 3. Créer les topics Kafka automatiquement
# 4. Démarrer tous les microservices avec logs colorés
```

### Option 2: Démarrage Manuel par Étapes

```bash
# 1. Démarrer l'infrastructure Docker
npm run monitoring:up

# 2. Créer les topics Kafka
npm run topics

# 3. Démarrer tous les microservices (dans un seul terminal)
npm run start:all
```

### Option 3: Démarrage Service par Service

```bash
# Démarrer l'infrastructure
npm run monitoring:up && npm run topics

# Dans des terminaux séparés :
npm run dev:commande    # Terminal 1
npm run dev:paiement    # Terminal 2  
npm run dev:suivi       # Terminal 3
npm run dev:analyseur   # Terminal 4
```

### 3. Accéder aux Interfaces

- **Grafana** : http://localhost:3000 (admin/admin)
- **Prometheus** : http://localhost:9090
- **Service Commande API** : http://localhost:3001
- **Service Suivi API** : http://localhost:3002
- **Service Analyseur API** : http://localhost:3003
- **Service Paiement Health** : http://localhost:3004

## Test du Système

### Créer une Transaction

```bash
curl -X POST http://localhost:3001/orders \\
  -H "Content-Type: application/json" \\
  -d '{
    "userId": "user123",
    "amount": 100.50,
    "items": ["item1", "item2"]
  }'
```

### Vérifier les Métriques

```bash
# Métriques du service commande
curl http://localhost:3001/metrics

# Métriques du service paiement
curl http://localhost:3004/metrics

# Statistiques calculées
curl http://localhost:3003/statistics

# Suivi d'une commande
curl http://localhost:3002/orders/order-1/status
```

## Métriques Collectées

### Métriques Kafka
- `kafka_messages_produced_total` - Messages produits par topic et service
- `kafka_messages_consumed_total` - Messages consommés par topic et service
- `kafka_message_processing_duration_seconds` - Latence de traitement
- `kafka_consumer_lag` - Retard des consommateurs

### Métriques HTTP
- `http_requests_total` - Nombre de requêtes HTTP par service/route/code
- `http_request_duration_seconds` - Durée des requêtes HTTP

### Métriques Métier (Banking)
- `orders_total` - Nombre total de commandes créées
- `payments_total` - Nombre de paiements par statut (authorized/rejected)
- `order_amount_euros` - Distribution des montants des commandes

### Métriques Système
- `process_uptime_seconds` - Temps de fonctionnement des services
- `process_memory_usage_bytes` - Utilisation mémoire par type

## Dashboards Grafana

### 1. Kafka Banking System Overview
- Vue d'ensemble du système de messages Kafka
- Métriques de production/consommation
- Statistiques bancaires (commandes, paiements)
- Latence de traitement des messages

### 2. Microservices Health Dashboard
- Santé des services HTTP
- Métriques de performance (requêtes/sec, temps de réponse)
- Utilisation des ressources système
- Temps de fonctionnement des services

## Configuration Avancée

### Ajout de Nouvelles Métriques

Dans `services/shared/metrics.js`, ajouter :

```javascript
const myCustomMetric = new client.Counter({
  name: 'my_custom_metric_total',
  help: 'Description of my custom metric',
  labelNames: ['label1', 'label2'],
  registers: [register]
});

// Dans votre service
myCustomMetric.inc({ label1: 'value1', label2: 'value2' });
```

### Personnalisation des Dashboards

1. Aller sur Grafana (http://localhost:3000)
2. Modifier les dashboards existants ou en créer de nouveaux
3. Utiliser les métriques Prometheus disponibles

### Alertes (optionnel)

Ajouter des règles d'alerting dans `monitoring/prometheus.yml` :

```yaml
rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

## Résolution de Problèmes

### Services ne remontent pas de métriques

1. Vérifier que les services sont démarrés : `docker compose ps`
2. Tester l'endpoint métriques : `curl http://localhost:3001/metrics`
3. Vérifier la config Prometheus : http://localhost:9090/targets

### JMX Exporter ne fonctionne pas

1. Vérifier que le port JMX de Kafka est exposé (1099)
2. Tester la connexion : `curl http://localhost:5556/metrics`
3. Vérifier les logs : `docker compose logs kafka-jmx-exporter`

### Dashboards Grafana vides

1. Vérifier que Prometheus collecte bien les données
2. Tester les requêtes dans Prometheus : http://localhost:9090/graph
3. Vérifier la datasource dans Grafana

## Arrêt du Système

```bash
# Arrêter tous les services Docker
npm run monitoring:down

# Ou arrêter individuellement
docker compose down
```

## Structure du Projet

```
├── services/
│   ├── shared/
│   │   └── metrics.js          # Métriques Prometheus partagées
│   ├── commande/index.js       # Service producteur
│   ├── paiement/index.js       # Service consommateur
│   ├── suivi/index.js          # Service agrégation
│   └── analyseur/index.js      # Service statistiques
├── monitoring/
│   ├── prometheus.yml          # Configuration Prometheus
│   └── grafana/
│       ├── provisioning/       # Configuration auto Grafana
│       └── dashboards/         # Dashboards JSON
├── docker-compose.yml          # Kafka
├── docker-compose.monitoring.yml # Stack monitoring
└── MONITORING.md              # Cette documentation
```

## Bonnes Pratiques

1. **Nommage des métriques** : Utiliser des noms descriptifs avec unités
2. **Labels** : Minimiser les cardinalités, éviter les valeurs dynamiques
3. **Rétention** : Configurer la rétention selon vos besoins (15j par défaut)
4. **Dashboards** : Organiser par domaine fonctionnel
5. **Alertes** : Alerter sur les métriques business critiques

## Évolutions Possibles

- [ ] Ajout d'AlertManager pour les notifications
- [ ] Métriques JVM détaillées avec Micrometer
- [ ] Distributed tracing avec Jaeger/Zipkin
- [ ] Logging centralisé avec ELK Stack
- [ ] Tests de charge automatisés
- [ ] SLI/SLO monitoring