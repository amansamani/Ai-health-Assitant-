import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import API from "../../services/api";

export default function NutritionDashboardScreen({ navigation }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = async () => {
  try {
    const res = await API.get("/nutrition/current");

    if (!res.data || !res.data.meals) {
      console.log("No diet plan yet");
      return;
    }

    setPlan(res.data);

  } catch (err) {
    console.log("Diet fetch error:", err.response?.data || err.message);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchPlan();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.center}>
        <Text>No diet plan found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Today's Nutrition Plan</Text>

      {/* Macros */}
      <View style={styles.card}>
        <Text>Target Calories: {plan.targetCalories}</Text>
        <Text>Protein: {plan.macroSplit.protein} g</Text>
        <Text>Carbs: {plan.macroSplit.carbs} g</Text>
        <Text>Fats: {plan.macroSplit.fats} g</Text>
      </View>

      {/* Meals */}
      {["breakfast", "lunch", "dinner", "snack"].map((meal) => (
        <View key={meal} style={styles.card}>
          <Text style={styles.mealTitle}>{meal.toUpperCase()}</Text>

          {plan.meals[meal]?.map((food, index) => (
            <Text key={index}>
              {food.name} — {food.grams}g
            </Text>
          ))}
        </View>
      ))}

      {/* Buttons */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("LogMeal")}
      >
        <Text style={styles.buttonText}>Log Today's Meals</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Progress")}
      >
        <Text style={styles.buttonText}>View Progress</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
  },

  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 3,
  },

  mealTitle: {
    fontWeight: "bold",
    marginBottom: 8,
  },

  button: {
    backgroundColor: "#4CAF50",
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },

  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
});