#!/bin/bash

echo "🧪 ================================================"
echo "   TESTS RAPIDES POUR LA DÉMO"
echo "================================================"

BASE_URL="http://localhost:3001"
SUIVI_URL="http://localhost:3002"
STATS_URL="http://localhost:3003"

echo ""
echo "1️⃣ Test de création de commande..."
ORDER_RESPONSE=$(curl -s -X POST ${BASE_URL}/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo-user","amount":150.75,"items":["laptop","mouse"]}')

echo "Réponse: $ORDER_RESPONSE"

# Extraire l'orderId de la réponse
ORDER_ID=$(echo $ORDER_RESPONSE | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4)
echo "Order ID créé: $ORDER_ID"

echo ""
echo "2️⃣ Attente de 3 secondes pour le traitement..."
sleep 3

echo ""
echo "3️⃣ Vérification du statut de la commande..."
curl -s ${SUIVI_URL}/orders/${ORDER_ID}/status | jq '.'

echo ""
echo "4️⃣ Statistiques globales..."
curl -s ${STATS_URL}/statistics | jq '.'

echo ""
echo "5️⃣ Liste des commandes..."
curl -s ${SUIVI_URL}/orders | jq '.totalCount'

echo ""
echo "6️⃣ Test de plusieurs commandes rapides..."
for i in {1..5}; do
  AMOUNT=$((50 + RANDOM % 200))
  USER_ID="user-${i}"
  
  echo "   Création commande ${i}/5 pour ${USER_ID} (${AMOUNT}€)..."
  curl -s -X POST ${BASE_URL}/orders \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"${USER_ID}\",\"amount\":${AMOUNT},\"items\":[\"item${i}\"]}" | jq '.orderId'
  
  sleep 0.5
done

echo ""
echo "7️⃣ Statistiques finales..."
curl -s ${STATS_URL}/statistics | jq '.totalTransactions, .authorizedTransactions, .rejectedTransactions, .averageAmount'

echo ""
echo "✅ Tests terminés ! Vérifiez les dashboards Grafana : http://localhost:3000"
echo "================================================"