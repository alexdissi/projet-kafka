# 🎬 Guide de Démonstration Live - Monitoring Kafka avec Prometheus et Grafana

Ce guide détaille toutes les étapes pour réussir votre démonstration live du système de monitoring des microservices Kafka.

## 📋 Checklist de Préparation (5 minutes avant la démo)

### ✅ Vérifications Techniques
- [ ] Docker Desktop est démarré et fonctionne
- [ ] Node.js 18+ installé (`node --version`)
- [ ] Port 3000, 3001, 3002, 3003, 3004, 9090 libres
- [ ] Connexion internet stable (pour Docker images)
- [ ] Terminal avec police lisible (recommandé: 14pt minimum)

### ✅ Préparation Navigateur
Ouvrir ces onglets **AVANT** la démo :
1. **Grafana** : http://localhost:3000 (login: admin/admin)
2. **Prometheus** : http://localhost:9090
3. **API Commande** : http://localhost:3001
4. **API Suivi** : http://localhost:3002
5. **API Analyseur** : http://localhost:3003

## 🚀 Script de Démonstration (20-30 minutes)

### Phase 1: Introduction et Architecture (5 minutes)

> **Script**: "Aujourd'hui, je vais vous présenter un système complet de monitoring pour des microservices Kafka avec Prometheus et Grafana, développé entièrement en JavaScript."

1. **Expliquer l'architecture** en montrant le diagramme dans README.md
2. **Présenter les technologies** : Kafka, Prometheus, Grafana, Node.js, Hono
3. **Objectif** : Monitoring en temps réel d'un système bancaire basé sur des événements

### Phase 2: Démarrage du Système (3 minutes)

```bash
# Terminal 1 - Démarrage automatique
cd /path/to/kafka-project
npm start
```

> **Script**: "Avec une seule commande, nous démarrons toute l'infrastructure : Kafka, Prometheus, Grafana et nos 4 microservices."

**Montrer les logs colorés** qui apparaissent :
- 🐳 Démarrage Docker
- ⏳ Attente des services
- 📝 Création des topics
- 🔄 Démarrage des microservices avec logs colorés

### Phase 3: Validation des Services (2 minutes)

**Montrer que tout fonctionne :**

```bash
# Terminal 2 - Tests rapides
# Vérifier Prometheus
curl http://localhost:9090/-/healthy

# Test simple d'une commande
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo-user","amount":99.99,"items":["laptop"]}'

# Vérifier les statistiques
curl http://localhost:3003/statistics
```

> **Script**: "Nous pouvons voir que notre première commande a été traitée et les statistiques sont déjà disponibles."

### Phase 4: Configuration des Dashboards Grafana (5 minutes)

1. **Aller sur Grafana** : http://localhost:3000
2. **Se connecter** : admin/admin
3. **Montrer les dashboards** pré-configurés :
   - "Kafka Banking System Overview"
   - "Microservices Health Dashboard"

**Points à souligner :**
- Configuration automatique via provisioning
- Dashboards pré-créés avec les métriques importantes
- Connexion automatique à Prometheus

### Phase 5: Démonstration de Charge (10 minutes)

**C'est le moment fort de la démo !**

```bash
# Terminal 2 - Lancer le test de charge
npm run demo
```

> **Script**: "Nous allons maintenant simuler une charge réaliste avec 20 utilisateurs concurrents envoyant des commandes pendant 2 minutes."

**Pendant le test de charge :**

1. **Montrer le terminal** avec les statistiques en temps réel
2. **Aller sur Grafana** et montrer l'évolution :
   - Dashboard "Kafka Banking System Overview"
   - Graphiques des messages produits/consommés
   - Métriques de latence
   - Statistiques des paiements (authorized/rejected)

3. **Naviguer entre les panels Grafana** :
   - "Kafka Messages Produced Rate" - Montrer la montée en charge
   - "Payment Status Distribution" - Voir le ratio auth/rejected en temps réel
   - "Message Processing Latency" - Observer les performances
   - "Total Orders" - Compteur qui augmente

4. **Dashboard Microservices Health** :
   - HTTP Request Rate - Trafic sur les APIs
   - Memory Usage - Consommation des services
   - Service Uptime - Stabilité du système

### Phase 6: Analyse des Résultats (3 minutes)

**Après la fin du test de charge :**

```bash
# Vérifier les résultats finaux
curl http://localhost:3003/statistics | jq '.'

# Voir les commandes traitées
curl http://localhost:3002/orders | jq '.totalCount'

# Vérifier une commande spécifique
curl http://localhost:3002/orders/order-5/status | jq '.'
```

**Montrer dans Grafana :**
- Les pics de charge et la descente
- Les métriques de performance maintenues
- La répartition des paiements
- L'absence d'erreurs système

### Phase 7: Exploration Prometheus (2 minutes)

**Aller sur Prometheus** : http://localhost:9090

**Montrer quelques requêtes :**
```promql
# Taux de messages Kafka
rate(kafka_messages_produced_total[5m])

# Latence 95e percentile
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Total des commandes
sum(orders_total)

# Ratio de paiements autorisés
sum(payments_total{status="authorized"}) / sum(payments_total) * 100
```

> **Script**: "Prometheus nous donne accès à toutes les métriques raw et permet de créer des requêtes complexes."

## 🎯 Points Clés à Souligner

### Architecture Event-Driven
- **Asynchrone** : Communication via événements Kafka
- **Découplage** : Services indépendants
- **Résilience** : Gestion d'erreurs avec DLQ

### Monitoring Complet
- **Métriques Applicatives** : Messages Kafka, latence, business metrics
- **Métriques Infrastructure** : HTTP, mémoire, CPU
- **Temps Réel** : Dashboards auto-refresh toutes les 5 secondes

### Facilité d'Usage
- **Une commande** : `npm start` démarre tout
- **Configuration automatique** : Dashboards et datasources pré-configurés
- **Tests intégrés** : Script de charge inclus

## 🚨 Gestion des Problèmes Potentiels

### Si un service ne démarre pas :
```bash
# Vérifier les logs
docker compose logs kafka
docker compose logs prometheus
docker compose logs grafana

# Redémarrer si nécessaire
npm run monitoring:down
npm run monitoring:up
```

### Si Grafana affiche "No data" :
1. Vérifier que Prometheus collecte bien : http://localhost:9090/targets
2. Vérifier les requêtes dans Prometheus
3. Rafraîchir les dashboards (F5)

### Si le test de charge échoue :
```bash
# Vérifier que les services répondent
curl http://localhost:3001/
curl http://localhost:3002/
curl http://localhost:3003/

# Redémarrer les microservices si besoin
npm run start:all
```

## 📊 Métriques à Mettre en Valeur

### Métriques Business
- **orders_total** : Nombre total de commandes
- **payments_total{status="authorized|rejected"}** : Répartition des paiements
- **order_amount_euros** : Distribution des montants

### Métriques Techniques
- **kafka_messages_produced_total** : Production des messages
- **kafka_messages_consumed_total** : Consommation des messages
- **kafka_message_processing_duration_seconds** : Latence de traitement
- **http_requests_total** : Trafic HTTP
- **process_memory_usage_bytes** : Utilisation mémoire

## 🎬 Phrases d'Impact pour la Démo

- *"En une seule commande, nous avons démarré un système distribué complet avec monitoring"*
- *"Nous pouvons voir en temps réel chaque transaction qui passe dans le système"*
- *"Grafana nous montre que malgré 20 utilisateurs simultanés, la latence reste stable"*
- *"Le système traite X commandes par seconde avec un taux d'autorisation de Y%"*
- *"Cette architecture permet de faire du monitoring proactif et de détecter les problèmes avant qu'ils n'impactent les utilisateurs"*

## 📝 Questions Potentielles et Réponses

**Q: Pourquoi JavaScript plutôt que Java pour Kafka ?**
R: JavaScript avec Node.js permet un développement rapide et moderne. KafkaJS est une bibliothèque mature et performante.

**Q: Comment gérez-vous la montée en charge ?**
R: Architecture event-driven avec partitioning Kafka et déploiement horizontal des microservices.

**Q: Que se passe-t-il si un service tombe ?**
R: Kafka assure la persistence des messages, et nous avons des Dead Letter Queues pour gérer les erreurs.

**Q: Peut-on ajouter d'autres métriques ?**
R: Oui, très facilement avec prom-client. Il suffit d'ajouter des counters/gauges/histograms dans le code.

---

## 🚀 Commandes de Démo - Résumé

```bash
# Démarrage
npm start

# Test de charge
npm demo

# Tests manuels
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","amount":50,"items":["item"]}'

# Vérifications
curl http://localhost:3003/statistics
curl http://localhost:3002/orders

# Arrêt propre
Ctrl+C (dans le terminal npm start)
```

**Bonne démonstration ! 🎉**