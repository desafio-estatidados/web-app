import React, { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { AlertSettings } from '../types';

interface AlertSettingsProps {
  settings: AlertSettings;
  onSettingsChange: (settings: AlertSettings) => void;
}

function AlertSettingsComponent({ settings, onSettingsChange }: AlertSettingsProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md space-y-6">
      <h2 className="text-lg font-semibold">Alert Settings</h2>

      {/* Location Alert */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Location Alert</h3>
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
          {settings.enabled ? (
            <Bell className="h-5 w-5 text-green-500" />
          ) : (
            <BellOff className="h-5 w-5 text-red-500" />
          )}
          <button
            onClick={() => onSettingsChange({ ...settings, enabled: !settings.enabled })}
            className="ml-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {settings.enabled ? 'Disable' : 'Enable'} Location Alert
          </button>
        </div>
      </div>

      {/* Location Selection */}
      <div>
        <button
          onClick={() => {
            if ("geolocation" in navigator) {
              navigator.geolocation.getCurrentPosition((position) => {
                onSettingsChange({
                  ...settings,
                  location: {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                  }
                });
              });
            }
          }}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Use Current Location
        </button>
      </div>

      {/* Alert Radius */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Alert Radius (km)
        </label>
        <input
          type="number"
          value={settings.radius}
          onChange={(e) => onSettingsChange({ ...settings, radius: parseFloat(e.target.value) })}
          className="w-full p-2 border rounded-md"
          min="1"
          max="100"
        />
      </div>
    </div>
  );
}

export default AlertSettingsComponent;