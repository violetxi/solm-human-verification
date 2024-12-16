import warnings
import os
import pandas as pd
from google.cloud import firestore
from google.api_core.datetime_helpers import DatetimeWithNanoseconds

warnings.filterwarnings('ignore')
# Set the credentials path
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'solm-human-verificatoin-firebase-adminsdk-nn8xr-4858034565.json'

# Initialize Firestore client
db = firestore.Client()

def convert_timestamps(data):    
    """Convert Firebase timestamps to ISO format"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, DatetimeWithNanoseconds):
                data[key] = value.isoformat()
            elif isinstance(value, dict):
                data[key] = convert_timestamps(value)
            elif isinstance(value, list):
                data[key] = [convert_timestamps(item) if isinstance(item, dict) else item for item in value]
    return data

def download_study_data(output_path=None):
    """Download and process study data"""
    # Get participants collection
    participants_ref = db.collection('participants')
    all_data = []

    # Stream all documents
    for doc in participants_ref.stream():
        participant_data = doc.to_dict()
        participant_data = convert_timestamps(participant_data)
        
        # Process responses
        for response in participant_data.get('responses', []):
            row = {
                'prolific_id': participant_data.get('prolificId'),
                'start_time': participant_data.get('startTime'),
                'original_statement': response.get('original_statement'),
                'original_label': response.get('original_label'),
                'pass_verification': response.get('pass_verification'),
                'label_alignment': response.get('labelAlignment'),
                'redundant_content': response.get('redundantContent'),
                'natural_flow': response.get('naturalFlow'),
                'response_timestamp': response.get('timestamp')
            }
            all_data.append(row)

    # Convert to DataFrame
    df = pd.DataFrame(all_data)
    
    # Generate output filename if not provided
    if output_path is None:
        output_path = 'study_results.csv'
    
    # Save to CSV
    df.to_csv(output_path, index=False)
    print(f"Data saved to {output_path}")
    print(f"Total responses: {len(df)}")
    print(f"Unique participants: {df['prolific_id'].nunique()}")
    
    return df

if __name__ == "__main__":
    df = download_study_data()