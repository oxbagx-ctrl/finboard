<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Virtual Data Room (VDR) Physical Encryption at Rest (AES-256-GCM)
    |--------------------------------------------------------------------------
    |
    | FinBoard Virtual Data Room provides physical encryption at rest for
    | all confidential deal advisory and M&A documents using AES-256-GCM
    | authenticated encryption.
    |
    */

    'encryption' => [
        'enabled' => (bool) env('VDR_ENCRYPTION_ENABLED', true),
        'algorithm' => env('VDR_ENCRYPTION_ALGO', 'aes-256-gcm'),
        'key' => env('VDR_ENCRYPTION_KEY'),
        'active_key_id' => env('VDR_ACTIVE_KEY_ID', 'vdr-key-1'),
        'keys' => array_filter([
            env('VDR_ACTIVE_KEY_ID', 'vdr-key-1') => env('VDR_ENCRYPTION_KEY'),
        ]),
        'hkdf_info' => 'vdr-storage-aes-256-gcm',
    ],

    /*
    |--------------------------------------------------------------------------
    | Storage and Cloud Provider Configuration
    |--------------------------------------------------------------------------
    |
    | Defines configuration parameters for local disk or OCI Object Storage
    | (S3-compatible bucket) without coupling to the local filesystem path.
    |
    */

    'storage' => [
        'disk' => env('VDR_STORAGE_DISK', 'local'),
        'base_directory' => env('VDR_STORAGE_BASE_DIR', 'dataroom'),
    ],
];
