import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ScannerScreen from '../screens/ScannerScreen';
import ResultScreen from '../screens/ResultScreen';

const Stack = createStackNavigator();

export default function ScannerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScannerMain" component={ScannerScreen} />
      <Stack.Screen 
        name="Result" 
        component={ResultScreen}
        options={{
          tabBarStyle: { display: 'none' },
        }}
      />
    </Stack.Navigator>
  );
}