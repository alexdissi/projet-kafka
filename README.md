# Kafka Banking Microservices

Mini projet bancaire avec **KafkaJS** et **Hono** - 3 microservices communiquant via Kafka.

## Architecture

- **accounts-svc** (port 3001): API Hono + publication d'événements `accounts.created`
- **payments-svc**: Consomme `accounts.created`, traite les paiements, publie `payments.processed`  
- **notifications-svc**: Consomme `payments.processed` et affiche des notifications

## Démarrage rapide

```bash
# 1. Installation des dépendances
npm install

# 2. Démarrer Kafka
npm run kafka:up

# 3. Créer les topics
npm run topics

# 4. Démarrer les services (3 terminaux séparés)
npm run dev:accounts        # Terminal 1
npm run dev:payments        # Terminal 2  
npm run dev:notifications   # Terminal 3

# 5. Tester l'API
curl http://localhost:3001/
# Retourne: hello world
```

## Flux de données

```
accounts-svc → accounts.created → payments-svc → payments.processed → notifications-svc
```

## Services détaillés

### accounts-svc
- **HTTP**: `GET /` retourne `"hello world"`
- **Kafka**: Publie `accounts.created` toutes les 3 secondes
- **Port**: 3001

### payments-svc  
- **Kafka**: Consomme `accounts.created` (groupe: `payments-svc`)
- **Traitement**: Simule un paiement (500ms)
- **Kafka**: Publie `payments.processed`

### notifications-svc
- **Kafka**: Consomme `payments.processed` (groupe: `notifications-svc`) 
- **Affichage**: Log des notifications de paiement

## Scripts disponibles

```bash
npm run dev:accounts        # Démarrer le service comptes
npm run dev:payments        # Démarrer le service paiements  
npm run dev:notifications   # Démarrer le service notifications
npm run topics              # Créer les topics Kafka
npm run kafka:up            # Démarrer Kafka
npm run kafka:down          # Arrêter Kafka
```

## Topics Kafka

- `accounts.created` (3 partitions)
- `payments.processed` (3 partitions)

## Dépannage

**Kafka ne répond pas?**
- Vérifier que Docker est démarré
- Relancer: `npm run kafka:down && npm run kafka:up`
- Attendre 10-15 secondes puis: `npm run topics`

**Erreur de connexion?**  
- Vérifier les ports (9092 pour Kafka, 3001 pour accounts-svc)
- Vérifier les logs Docker: `docker logs kafka`

**Topics non créés?**
- Relancer: `npm run topics`
- Vérifier les topics: `docker exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list`