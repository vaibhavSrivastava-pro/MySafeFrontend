import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface FormData {
  host: string;
  port: string;
  username: string;
  password: string;
}

const STORAGE_KEY = 'savedConnectionCredentials';

const Connect: React.FC = () => {
  const navigation = useNavigation<any>();

  const [formData, setFormData] = useState<FormData>({
    host: '',
    port: '',
    username: '',
    password: '',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveCredentials, setSaveCredentials] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load saved credentials when component mounts
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedData = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          setFormData(prev => ({
            ...prev,
            host: parsedData.host || '',
            port: parsedData.port || '',
            username: parsedData.username || '',
            // Note: password is not loaded from storage
          }));
        }
      } catch (error) {
        console.error('Error loading saved credentials:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedCredentials();
  }, []);

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear any previous error messages when user makes changes
    if (error) {setError(null);}
  };

  const saveCredentialsToStorage = async () => {
    if (saveCredentials) {
      try {
        const dataToSave = {
          host: formData.host,
          port: formData.port,
          username: formData.username,
          // Password is intentionally not saved
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (error) {
        console.error('Error saving credentials:', error);
      }
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Form data:', process.env);
      const response = await fetch(`http://192.168.217.124:3000/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: formData.host,
          port: parseInt(formData.port, 10),
          user: formData.username,
          pass: formData.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to connect');
      }

      const data = await response.json();
      
      // Save credentials if user opted to do so
      await saveCredentialsToStorage();
      
      Alert.alert('Success', 'Connection successful!');
      navigation.navigate('Home');
      console.log('Connection successful:', data);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Connection error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearSavedCredentials = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setFormData({
        host: '',
        port: '',
        username: '',
        password: '',
      });
      Alert.alert('Success', 'Saved credentials cleared');
    } catch (error) {
      console.error('Error clearing credentials:', error);
      Alert.alert('Error', 'Failed to clear saved credentials');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading saved connection info...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Connect to Server</Text>

          {error && <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Host</Text>
            <TextInput
              style={styles.input}
              value={formData.host}
              onChangeText={(text) => handleChange('host', text)}
              placeholder="Enter host"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={formData.port}
              onChangeText={(text) => handleChange('port', text)}
              placeholder="Enter port"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={formData.username}
              onChangeText={(text) => handleChange('username', text)}
              placeholder="Enter username"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={formData.password}
              onChangeText={(text) => handleChange('password', text)}
              placeholder="Enter password"
              secureTextEntry
            />
          </View>

          <View style={styles.checkboxContainer}>
            <Switch
              value={saveCredentials}
              onValueChange={setSaveCredentials}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={saveCredentials ? '#007AFF' : '#f4f3f4'}
            />
            <Text style={styles.checkboxLabel}>Save connection details (except password)</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearSavedCredentials}
          >
            <Text style={styles.clearButtonText}>Clear Saved Credentials</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#4a6fa5',
    marginBottom: 24,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#dbe1e8',
    borderRadius: 4,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4a6fa5',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#a0aec0',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 14,
  },
  clearButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FF3B30',
    fontSize: 14,
  }
});

export default Connect;
